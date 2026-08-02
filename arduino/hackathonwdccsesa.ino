#include <LiquidCrystal.h>

// LCD pin order: RS, E, D4, D5, D6, D7
LiquidCrystal lcd(6, 7, 5, 4, 3, 2);

// Piezo buzzer
const int piezoPin = 10;

// Push button
const int buttonPin = 9;
const unsigned long buttonDebounceDelay = 50;

int buttonState = HIGH;
int lastButtonReading = HIGH;
unsigned long lastButtonChangeTime = 0;

// Health settings
const int maxHealth = 100;
const int healthChange = 20;
const int smallHealthChange = 10;
const int desperateHealthThreshold = 50;

int healthLevel = 100;
// Prevent the low-health alert from starting again until health recovers.
bool desperateAlertPlayed = false;
// The DESPERATE alarm repeats until the button acknowledges it.
bool desperateAlarmActive = false;
bool desperateAlarmAcknowledged = false;


// ==================================================
// Rabbit expressions
// ==================================================

enum RabbitExpression
{
  NORMAL_FACE,
  HEAL_FACE,
  DAMAGE_FACE,
  DEATH_FACE,
  BOTHER_FACE,
  DESPERATE_FACE
};

RabbitExpression currentExpression = NORMAL_FACE;


// ==================================================
// Blink settings
// ==================================================

bool eyesClosed = false;

unsigned long lastBlinkTime = 0;
unsigned long blinkStartTime = 0;

const unsigned long blinkInterval = 2000;
const unsigned long blinkDuration = 200;


// ==================================================
// Temporary message settings
// ==================================================

bool temporaryMessageActive = false;
unsigned long messageStartTime = 0;

const unsigned long messageDuration = 2500;

// Shown when the button is pressed, so the pet reads as waiting to hear back
// from the server. Ten characters, which is all the 12-column text area holds.
const char *waitingMessage = "WAITING...";


// ==================================================
// Fixed rabbit body parts
// 3 columns × 2 rows = 15 × 16 pixels
// ==================================================

// Rabbit top-left: left ear and face outline
byte rabbitTopLeft[8] = {
  B00011,
  B00100,
  B00100,
  B00100,
  B00100,
  B01000,
  B01000,
  B01000
};

// Rabbit top-right: right ear and face outline
byte rabbitTopRight[8] = {
  B11000,
  B00100,
  B00100,
  B00100,
  B00100,
  B00010,
  B00010,
  B00010
};

// Rabbit bottom-left: left body and foot
byte rabbitBottomLeft[8] = {
  B01000,
  B01000,
  B00100,
  B00011,
  B00001,
  B00011,
  B00101,
  B00111
};

// Rabbit bottom-right: right body and foot
byte rabbitBottomRight[8] = {
  B00010,
  B00010,
  B00100,
  B11000,
  B10000,
  B11000,
  B10100,
  B11100
};


// ==================================================
// NORMAL expression
// ==================================================

// Normal face: eyes open
byte rabbitTopMiddleNormal[8] = {
  B00000,
  B10001,
  B10001,
  B01110,
  B00000,
  B00000,
  B10001,
  B10001
};

// Normal face: eyes closed
byte rabbitTopMiddleClosed[8] = {
  B00000,
  B10001,
  B10001,
  B01110,
  B00000,
  B00000,
  B00000,
  B11011
};

// Normal nose and mouth
byte rabbitBottomMiddleNormal[8] = {
  B00100,
  B01110,
  B00000,
  B11111,
  B00000,
  B00000,
  B00000,
  B00000
};


// DEATH expression
// X-shaped eyes with normal nose and mouth
// ==================================================

byte rabbitTopMiddleDeath[8] = {
  B01110,
  B10001,
  B10001,
  B01110,
  B00000,
  B10101,
  B01010,
  B10101
};

byte rabbitBottomMiddleDeath[8] = {
  B00100,
  B01110,
  B00000,
  B11111,
  B00000,
  B00000,
  B00000,
  B00000
};


// ==================================================
// Effect icons shown to the left of the rabbit
// ==================================================

// LCD custom character slot 7 is reused for these icons.
// Only one left-side effect icon can be visible at a time.

byte effectHeart[8] = {
  B00000,
  B01010,
  B11111,
  B11111,
  B01110,
  B00100,
  B00000,
  B00000
};

byte effectStar[8] = {
  B00100,
  B01110,
  B10101,
  B01110,
  B00100,
  B00000,
  B00000,
  B00000
};

byte effectExclamation[8] = {
  B00100,
  B00100,
  B00100,
  B00100,
  B00100,
  B00000,
  B00100,
  B00000
};

byte effectDesperate[8] = {
  B00100,
  B01110,
  B10101,
  B00100,
  B00100,
  B00000,
  B00100,
  B00000
};

// ==================================================
// Setup
// ==================================================

void setup()
{
  pinMode(piezoPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);

  Serial.begin(9600);
  Serial.setTimeout(50);

  lcd.begin(16, 2);

  // Fixed rabbit parts
  lcd.createChar(0, rabbitTopLeft);
  lcd.createChar(2, rabbitTopRight);
  lcd.createChar(3, rabbitBottomLeft);
  lcd.createChar(5, rabbitBottomRight);

  // Slot 6 is reserved for normal blinking
  lcd.createChar(6, rabbitTopMiddleClosed);

  setRabbitExpression(NORMAL_FACE);
  showMainScreen();

  Serial.println("Arduino ready");
  Serial.println(
    "Commands: DAMAGE[:n], HEAL[:n], DEATH, RESET, BOTHER, DESPERATE"
  );
}


// ==================================================
// Main loop
// ==================================================

void loop()
{
  // Keep each subsystem small and non-blocking during normal operation.
  checkSerialCommand();
  checkButtonPress();
  updateBlink();
  updateTemporaryMessage();
}


// ==================================================
// Push button handling
// ==================================================

void checkButtonPress()
{
  int reading = digitalRead(buttonPin);

  // Debounce the mechanical switch before accepting a state change.
  if (reading != lastButtonReading)
  {
    lastButtonChangeTime = millis();
  }

  if (millis() - lastButtonChangeTime > buttonDebounceDelay)
  {
    if (reading != buttonState)
    {
      buttonState = reading;

      if (buttonState == LOW)
      {
        // Node.js can listen for this line on the serial connection.
        Serial.println("BUTTON_PUSHED");

        if (desperateAlarmActive)
        {
          desperateAlarmActive = false;
          desperateAlarmAcknowledged = true;
          Serial.println("DESPERATE_ACKNOWLEDGED");
        }

        showTemporaryMessage(waitingMessage);
      }
    }
  }

  lastButtonReading = reading;
}


// ==================================================
// Serial command handling
// ==================================================

// True only for a non-empty run of digits.
// toInt() answers 0 for anything it cannot parse, and 0 is a meaningful
// amount, so the digits have to be checked before trusting the conversion.
bool isNumeric(const String &value)
{
  if (value.length() == 0)
  {
    return false;
  }

  for (unsigned int index = 0; index < value.length(); index++)
  {
    if (!isDigit(value.charAt(index)))
    {
      return false;
    }
  }

  return true;
}


void checkSerialCommand()
{
  if (Serial.available() <= 0)
  {
    return;
  }

  String line = Serial.readStringUntil('\n');

  line.trim();
  line.toUpperCase();

  // Commands are case-insensitive because the input is normalized above.
  if (line.length() == 0)
  {
    return;
  }

  // Signals arrive as "COMMAND" or "COMMAND:AMOUNT". A missing or malformed
  // amount stays -1, which tells the handler to use its built-in step.
  String command = line;
  int amount = -1;

  int separator = line.indexOf(':');

  if (separator >= 0)
  {
    command = line.substring(0, separator);
    command.trim();

    String value = line.substring(separator + 1);
    value.trim();

    if (isNumeric(value))
    {
      amount = value.toInt();
    }
  }

  if (command == "DAMAGE")
  {
    handleDamage(amount);
  }
  else if (command == "HEAL")
  {
    handleHeal(amount);
  }
  else if (command == "DEATH")
  {
    handleDeath();
  }
  else if (command == "RESET")
  {
    handleReset();
  }
  else if (command == "BOTHER")
  {
    handleBother();
  }
  else if (command == "DESPERATE")
  {
    handleDesperate();
  }
  else
  {
    Serial.print("ERROR: Unknown command: ");
    Serial.println(command);

    Serial.println(
      "Valid commands: DAMAGE[:n], HEAL[:n], DEATH, RESET, BOTHER, DESPERATE"
    );
  }
}


// ==================================================
// Health helpers
// ==================================================

// Turn the amount parsed off the serial line into a usable health step.
// A negative amount means the sender omitted it, so the built-in step keeps
// the original behaviour for bare DAMAGE and HEAL commands.
int resolveAmount(int amount)
{
  if (amount < 0)
  {
    return healthChange;
  }

  if (amount > maxHealth)
  {
    return maxHealth;
  }

  return amount;
}


bool decreaseHealthBy10()
{
  // Reserved for future commands that need smaller health changes.
  if (healthLevel <= 0)
  {
    return false;
  }

  healthLevel -= smallHealthChange;

  if (healthLevel <= 0)
  {
    healthLevel = 0;
    desperateAlarmActive = false;
  }

  return true;
}


bool increaseHealthBy10()
{
  // Reserved for future commands that need smaller health changes.
  if (healthLevel >= maxHealth)
  {
    return false;
  }

  healthLevel += smallHealthChange;

  if (healthLevel > maxHealth)
  {
    healthLevel = maxHealth;
  }

  if (healthLevel >= desperateHealthThreshold)
  {
    desperateAlertPlayed = false;
    desperateAlarmActive = false;
  }

  return true;
}


// ==================================================
// DAMAGE
// ==================================================

void handleDamage(int amount)
{
  // Already dead
  if (healthLevel <= 0)
  {
    setRabbitExpression(DEATH_FACE);
    showTemporaryMessage("GAME OVER");
    playDeathSound();

    Serial.println(
      "ERROR: Health is already 0%. DEATH response played."
    );

    return;
  }

  int step = resolveAmount(amount);

  // A zero step is a valid signal, it just has nothing to apply.
  if (step == 0)
  {
    Serial.println("DAMAGE ignored. Amount is 0.");
    return;
  }

  healthLevel -= step;

  // This damage caused death
  if (healthLevel <= 0)
  {
    healthLevel = 0;
    desperateAlarmActive = false;

    updateHealthDisplay();
    setRabbitExpression(DEATH_FACE);
    showTemporaryMessage("GAME OVER");
    playDeathSound();

    Serial.println(
      "DAMAGE accepted. Health reached 0%. DEATH response played."
    );

    return;
  }

  updateHealthDisplay();
  // The step is now sender-controlled, so a single hit can cross the
  // threshold. The flag still keeps the alarm from restarting every hit.
  if (
    healthLevel < desperateHealthThreshold &&
    !desperateAlertPlayed
  )
  {
    desperateAlertPlayed = true;
    setRabbitExpression(DAMAGE_FACE);
    showTemporaryMessage("OUCH!");
    playDamageSound();

    Serial.print("DAMAGE accepted. Health: ");
    Serial.print(healthLevel);
    Serial.println("%");
    Serial.println("DESPERATE auto-triggered.");

    playDesperateResponse();
    return;
  }
  else
  {
    setRabbitExpression(DAMAGE_FACE);
    showTemporaryMessage("OUCH!");
    playDamageSound();
  }

  Serial.print("DAMAGE accepted. Health: ");
  Serial.print(healthLevel);
  Serial.println("%");
}


// ==================================================
// HEAL
// ==================================================

void handleHeal(int amount)
{
  // A dead pet must be reset
  if (healthLevel <= 0)
  {
    setRabbitExpression(DEATH_FACE);
    showTemporaryMessage("USE RESET");

    Serial.println(
      "ERROR: Pet is dead. Use RESET to revive."
    );

    return;
  }

  // Cannot heal above 100%
  if (healthLevel >= maxHealth)
  {
    showTemporaryMessage("FULL HEALTH");

    Serial.println(
      "ERROR: Health is already 100%. HEAL ignored."
    );

    return;
  }

  int step = resolveAmount(amount);

  // A zero step is a valid signal, it just has nothing to apply.
  if (step == 0)
  {
    Serial.println("HEAL ignored. Amount is 0.");
    return;
  }

  healthLevel += step;

  if (healthLevel > maxHealth)
  {
    healthLevel = maxHealth;
  }

  updateHealthDisplay();
  setRabbitExpression(HEAL_FACE);
  showTemporaryMessage("HEALED!");
  playHealSound();

  if (healthLevel >= desperateHealthThreshold)
  {
    desperateAlertPlayed = false;
    desperateAlarmActive = false;
  }

  Serial.print("HEAL accepted. Health: ");
  Serial.print(healthLevel);
  Serial.println("%");
}


// ==================================================
// DEATH
// ==================================================

void handleDeath()
{
  if (healthLevel <= 0)
  {
    setRabbitExpression(DEATH_FACE);
    showTemporaryMessage("GAME OVER");
    playDeathSound();

    Serial.println(
      "ERROR: Pet is already dead. DEATH response replayed."
    );

    return;
  }

  healthLevel = 0;
  desperateAlarmActive = false;

  updateHealthDisplay();
  setRabbitExpression(DEATH_FACE);
  showTemporaryMessage("GAME OVER");
  playDeathSound();

  Serial.println("DEATH accepted. Health: 0%");
}


// ==================================================
// RESET
// ==================================================

void handleReset()
{
  healthLevel = maxHealth;
  desperateAlertPlayed = false;
  desperateAlarmActive = false;

  setRabbitExpression(NORMAL_FACE);
  playResetTransition();
  showResetScreen();

  Serial.println(
    "RESET accepted. Health restored to 100%."
  );
}


// ==================================================
// BOTHER
// ==================================================

void handleBother()
{
  if (healthLevel <= 0)
  {
    setRabbitExpression(DEATH_FACE);
    showTemporaryMessage("GAME OVER");

    Serial.println(
      "ERROR: Pet is dead. BOTHER ignored."
    );

    return;
  }

  setRabbitExpression(BOTHER_FACE);
  showTemporaryMessage("CHECK ME!");
  playBotherSound();

  Serial.println("BOTHER accepted.");
}


// ==================================================
// DESPERATE
// ==================================================

void handleDesperate()
{
  if (desperateAlarmActive)
  {
    Serial.println("DESPERATE already active.");
    return;
  }

  if (healthLevel <= 0)
  {
    setRabbitExpression(DEATH_FACE);
    showTemporaryMessage("GAME OVER");

    Serial.println(
      "ERROR: Pet is dead. DESPERATE ignored."
    );

    return;
  }

  playDesperateResponse();

  Serial.println("DESPERATE accepted.");
}


void playDesperateResponse()
{
  desperateAlarmActive = true;
  desperateAlarmAcknowledged = false;

  // Repeat the alarm until the physical button clears desperateAlarmActive.
  while (desperateAlarmActive)
  {
    setRabbitExpression(DESPERATE_FACE);
    showTemporaryMessage("NOTICE ME!");
    playDesperateSound();
    // Keep reading inputs while this repeating alarm owns the screen.
    checkButtonPress();
    checkSerialCommand();
    updateBlink();
    updateTemporaryMessage();
  }

  if (
    desperateAlarmAcknowledged &&
    healthLevel > 0
  )
  {
    // The acknowledgement was a button press, so land on the waiting message
    // instead of the idle greeting. setRabbitExpression redraws column 12,
    // which is what clears the desperate icon, and row 1 still holds health.
    setRabbitExpression(NORMAL_FACE);
    showTemporaryMessage(waitingMessage);
  }
}


// ==================================================
// Expression management
// ==================================================

void setRabbitExpression(RabbitExpression expression)
{
  currentExpression = expression;

  // Redefine LCD custom glyphs for the selected expression.
  eyesClosed = false;
  lastBlinkTime = millis();

  switch (expression)
  {
    case NORMAL_FACE:
      lcd.createChar(1, rabbitTopMiddleNormal);
      lcd.createChar(4, rabbitBottomMiddleNormal);
      break;

    case HEAL_FACE:
      lcd.createChar(1, rabbitTopMiddleNormal);
      lcd.createChar(4, rabbitBottomMiddleNormal);
      lcd.createChar(7, effectHeart);
      break;

    case DAMAGE_FACE:
      lcd.createChar(1, rabbitTopMiddleNormal);
      lcd.createChar(4, rabbitBottomMiddleNormal);
      lcd.createChar(7, effectExclamation);
      break;

    case DEATH_FACE:
      lcd.createChar(1, rabbitTopMiddleDeath);
      lcd.createChar(4, rabbitBottomMiddleDeath);
      break;

    case BOTHER_FACE:
      lcd.createChar(1, rabbitTopMiddleNormal);
      lcd.createChar(4, rabbitBottomMiddleNormal);
      lcd.createChar(7, effectStar);
      break;

    case DESPERATE_FACE:
      lcd.createChar(1, rabbitTopMiddleNormal);
      lcd.createChar(4, rabbitBottomMiddleNormal);
      lcd.createChar(7, effectDesperate);
      break;
  }

  drawRabbit(false);
}


// ==================================================
// LCD functions
// ==================================================

void showMainScreen()
{
  lcd.clear();

  lcd.setCursor(0, 0);

  if (healthLevel <= 0)
  {
    lcd.print("GAME OVER");
  }
  else
  {
    lcd.print("HELLO!");
  }

  updateHealthDisplay();
  drawRabbit(false);
}


// Clear only the text area.
// Column 12 is used for temporary icons. Columns 13, 14 and 15 belong to the rabbit.
void clearTextArea(int row)
{
  lcd.setCursor(0, row);

  for (int column = 0; column < 12; column++)
  {
    lcd.print(' ');
  }
}


void updateHealthDisplay()
{
  clearTextArea(1);

  lcd.setCursor(0, 1);
  lcd.print("Health:");
  lcd.print(healthLevel);
  lcd.print("%");

  drawRabbit(eyesClosed);
}


void showTemporaryMessage(const char *message)
{
  clearTextArea(0);

  lcd.setCursor(0, 0);
  lcd.print(message);

  temporaryMessageActive = true;
  messageStartTime = millis();

  drawRabbit(false);
}


void showResetScreen()
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("NEW GAME!");

  lcd.setCursor(0, 1);
  lcd.print("Health:");
  lcd.print(healthLevel);
  lcd.print("%");

  temporaryMessageActive = true;
  messageStartTime = millis();

  drawRabbit(false);
}


void playResetTransition()
{
  // A short Twinkle-style phrase drives both the timing and the buzzer.
  const int melody[] = {
    523, 523, 784, 784, 880, 880, 784,
    698, 698, 659, 659, 587, 587, 523
  };

  const int noteDurations[] = {
    160, 160, 160, 160, 160, 160, 300,
    160, 160, 160, 160, 160, 160, 360
  };

  const int noteCount = sizeof(melody) / sizeof(melody[0]);

  lcd.createChar(7, effectHeart);

  for (int frame = 0; frame < noteCount; frame++)
  {
    lcd.clear();

    for (int heart = 0; heart < 8; heart++)
    {
      // Stagger the hearts so they overlap while sweeping left to right.
      int column = (frame * 2) - (heart * 2);

      if (
        column < 0 ||
        column > 15
      )
      {
        continue;
      }

      lcd.setCursor(column, heart % 2);
      lcd.write(byte(7));
    }

    playNote(melody[frame], noteDurations[frame], noteDurations[frame] + 40);
  }

  lcd.clear();
}


void updateTemporaryMessage()
{
  if (!temporaryMessageActive)
  {
    return;
  }

  if (millis() - messageStartTime < messageDuration)
  {
    return;
  }

  temporaryMessageActive = false;

  clearTextArea(0);
  lcd.setCursor(0, 0);

  if (healthLevel <= 0)
  {
    lcd.print("GAME OVER");
    setRabbitExpression(DEATH_FACE);
  }
  else
  {
    lcd.print("HELLO!");
    setRabbitExpression(NORMAL_FACE);
  }
}


// ==================================================
// Rabbit blinking
// ==================================================

void updateBlink()
{
  // The default face keeps blinking while temporary icons are shown.
  if (currentExpression == DEATH_FACE)
  {
    return;
  }

  unsigned long currentTime = millis();

  if (
    !eyesClosed &&
    currentTime - lastBlinkTime >= blinkInterval
  )
  {
    eyesClosed = true;
    blinkStartTime = currentTime;

    drawRabbit(true);
  }

  if (
    eyesClosed &&
    currentTime - blinkStartTime >= blinkDuration
  )
  {
    eyesClosed = false;
    lastBlinkTime = currentTime;

    drawRabbit(false);
  }
}


// ==================================================
// Draw the effect icon plus the 3 × 2 rabbit
// ==================================================

void drawRabbit(bool closed)
{
  lcd.setCursor(12, 0);

  // Column 12 is a one-character effect slot beside the 3-column bunny.
  if (
    currentExpression == HEAL_FACE ||
    currentExpression == DAMAGE_FACE ||
    currentExpression == BOTHER_FACE ||
    currentExpression == DESPERATE_FACE
  )
  {
    lcd.write(byte(7));
  }
  else
  {
    lcd.print(' ');
  }

  lcd.write(byte(0));

  if (
    closed &&
    currentExpression != DEATH_FACE
  )
  {
    lcd.write(byte(6));
  }
  else
  {
    lcd.write(byte(1));
  }

  lcd.write(byte(2));

  lcd.setCursor(12, 1);

  lcd.print(' ');
  lcd.write(byte(3));
  lcd.write(byte(4));
  lcd.write(byte(5));
}


// ==================================================
// Sound effects
// ==================================================

void playDamageSound()
{
  playNote(900, 80, 90);
  playNote(650, 80, 90);
  playNote(400, 150, 160);
  playNote(220, 250, 260);
}


void playHealSound()
{
  playNote(523, 100, 120);   // C5
  playNote(659, 100, 120);   // E5
  playNote(784, 100, 120);   // G5
  playNote(1047, 250, 260);  // C6
}


void playDeathSound()
{
  playNote(698, 100, 140);  // F5
  playNote(698, 100, 140);  // F5
  playNote(698, 100, 140);  // F5
  playNote(698, 180, 260);  // F5

  playNote(659, 180, 220);  // E5
  playNote(587, 220, 260);  // D5
  playNote(523, 600, 650);  // C5
}


void playResetSound()
{
  playNote(523, 160, 200);  // C5
  playNote(523, 160, 200);  // C5
  playNote(784, 160, 200);  // G5
  playNote(784, 160, 200);  // G5
  playNote(880, 160, 200);  // A5
  playNote(880, 160, 200);  // A5
  playNote(784, 300, 340);  // G5

  playNote(698, 160, 200);  // F5
  playNote(698, 160, 200);  // F5
  playNote(659, 160, 200);  // E5
  playNote(659, 160, 200);  // E5
  playNote(587, 160, 200);  // D5
  playNote(587, 160, 200);  // D5
  playNote(523, 360, 400);  // C5
}


// Retro Tamagotchi-style attention alarm
void playBotherSound()
{
  for (int i = 0; i < 3; i++)
  {
    playNote(2400, 60, 90);
    playNote(2900, 60, 280);
  }
}


void playDesperateSound()
{
  for (int i = 0; i < 4; i++)
  {
    playDesperateNote(3100, 45, 65);
    playDesperateNote(1900, 45, 65);
  }

  playDesperateNote(3300, 70, 90);
  playDesperateNote(2800, 70, 90);
  playDesperateNote(2300, 90, 110);
  playDesperateNote(1700, 140, 170);
}


void playDesperateNote(
  int frequency,
  int duration,
  int pauseDuration
)
{
  if (!desperateAlarmActive)
  {
    return;
  }

  playNote(frequency, duration, pauseDuration);
  checkButtonPress();
}


void playNote(
  int frequency,
  int duration,
  int pauseDuration
)
{
  tone(piezoPin, frequency, duration);
  delay(pauseDuration);
  noTone(piezoPin);
}
