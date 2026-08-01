const { SerialPort } = require("serialport");
const readline = require("node:readline");

// Change this to the value shown in Arduino IDE under Tools > Port.
const ARDUINO_PORT = "/dev/cu.usbmodem1301";
const BAUD_RATE = 9600;

const validCommands = [
  "DAMAGE",
  "HEAL",
  "DEATH",
  "RESET",
  "BOTHER",
];

// Open the serial connection to Arduino.
const port = new SerialPort({
  path: ARDUINO_PORT,
  baudRate: BAUD_RATE,
});

// Terminal input interface.
const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Command > ",
});

let arduinoReady = false;
let receiveBuffer = "";

// Arduino connected successfully.
port.on("open", () => {
  console.log(`Arduino connected: ${ARDUINO_PORT}`);

  // Wait briefly after connection before accepting commands.
  setTimeout(() => {
    arduinoReady = true;

    console.log("\nAvailable commands:");
    console.log("  DAMAGE[:amount] - Reduce health, defaults to 20");
    console.log("  HEAL[:amount]   - Restore health, defaults to 20");
    console.log("  DEATH   - Set health to 0");
    console.log("  RESET   - Start again at 100%");
    console.log("  BOTHER  - Play attention sound");
    console.log("  EXIT    - Close the program\n");

    terminal.prompt();
  }, 2000);
});

// Handle responses sent by Arduino.
port.on("data", (data) => {
  receiveBuffer += data.toString();

  // Process Arduino Serial.println() output one line at a time.
  const lines = receiveBuffer.split(/\r?\n/);
  receiveBuffer = lines.pop() ?? "";

  for (const line of lines) {
    const message = line.trim();

    if (!message) {
      continue;
    }

    if (message.startsWith("ERROR:")) {
      console.log(`\nArduino error: ${message}`);
    } else {
      console.log(`\nArduino: ${message}`);
    }
  }

  if (arduinoReady) {
    terminal.prompt();
  }
});

// Serial connection error.
port.on("error", (error) => {
  console.error("\nSerial connection error:");
  console.error(error.message);
});

// Arduino connection closed.
port.on("close", () => {
  console.log("\nArduino connection closed.");
});

// Handle commands typed in the terminal.
terminal.on("line", (input) => {
  const command = input.trim().toUpperCase();

  // Accept "DAMAGE 10" or "DAMAGE:10" at the prompt. Either way the signal
  // goes out colon-delimited, which is the only form the Arduino parses.
  const commandParts = command.split(/[\s:]+/);
  const commandName = commandParts[0];
  const amountText = commandParts[1];

  if (command === "") {
    terminal.prompt();
    return;
  }

  if (command === "EXIT") {
    closeProgram();
    return;
  }

  if (!arduinoReady) {
    console.log("Arduino is not ready yet.");
    terminal.prompt();
    return;
  }

  if (!validCommands.includes(commandName)) {
    console.log(`ERROR: "${command}" is not a valid command.`);
    console.log(
      "Use DAMAGE[:amount], HEAL[:amount], DEATH, RESET, BOTHER, or EXIT."
    );
    terminal.prompt();
    return;
  }

  if (!isValidCommandAmount(commandName, amountText, commandParts.length)) {
    console.log(`ERROR: "${command}" has an invalid amount.`);
    console.log("Only DAMAGE and HEAL accept an amount from 1 to 100.");
    terminal.prompt();
    return;
  }

  sendCommand(commandName, amountText);
});

// Build the line the Arduino expects: "COMMAND" or "COMMAND:AMOUNT".
function buildSignal(commandName, amountText) {
  if (amountText === undefined || amountText === "") {
    return `${commandName}\n`;
  }

  return `${commandName}:${amountText}\n`;
}

// Send a command to Arduino.
function sendCommand(commandName, amountText) {
  // The newline terminates the line for Arduino readStringUntil('\n').
  const signal = buildSignal(commandName, amountText);
  const shown = signal.trim();

  port.write(signal, (error) => {
    if (error) {
      console.error(`Failed to send ${shown}: ${error.message}`);
      terminal.prompt();
      return;
    }

    console.log(`Sent: ${shown}`);
    terminal.prompt();
  });
}

function isValidCommandAmount(commandName, amountText, partCount) {
  if (partCount === 1) {
    return true;
  }

  if (partCount > 2) {
    return false;
  }

  if (commandName !== "DAMAGE" && commandName !== "HEAL") {
    return false;
  }

  if (!/^\d+$/.test(amountText)) {
    return false;
  }

  const amount = Number(amountText);

  return amount > 0 && amount <= 100;
}

// Close the program safely.
function closeProgram() {
  console.log("\nClosing program...");

  terminal.close();

  if (port.isOpen) {
    port.close((error) => {
      if (error) {
        console.error("Failed to close port:", error.message);
        process.exit(1);
      }

      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// Handle Control + C.
terminal.on("SIGINT", () => {
  closeProgram();
});
