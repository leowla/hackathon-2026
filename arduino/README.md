# Arduino Pet Bridge

This folder contains the Arduino sketch and the Node.js helper used to control the LCD pet over a serial connection.

## Files

### `hackathonwdccsesa.ino`

Arduino firmware for the LCD bunny pet.

It handles:

- LCD face rendering and blinking
- Health changes for `DAMAGE`, `HEAL`, `DEATH`, and `RESET`
- Attention sounds for `BOTHER` and `DESPERATE`
- Reset heart transition animation
- Push button input on pin 9
- Serial messages sent back to Node.js, such as `BUTTON_PUSHED`

Upload this file to the Arduino using the Arduino IDE.

### `index.js`

Node.js serial terminal for sending commands to the Arduino.

It handles:

- Opening the Arduino serial port
- Reading terminal commands
- Sending commands like `DAMAGE`, `HEAL`, `RESET`, and `BOTHER`
- Printing Arduino responses in the terminal

Before running it, update `ARDUINO_PORT` so it matches the port shown in Arduino IDE under **Tools > Port**.

## Basic Use

1. Upload `hackathonwdccsesa.ino` to the Arduino.
2. Close the Arduino Serial Monitor so Node.js can use the port.
3. Install Node dependencies if needed:

```bash
npm install serialport
```

4. Run the bridge:

```bash
node index.js
```

5. Type a command in the terminal and press Enter.

## Serial Commands

The Arduino accepts newline-delimited text commands over serial.

```txt
DAMAGE
DAMAGE 10
HEAL
HEAL 25
DEATH
RESET
BOTHER
```

`DAMAGE` and `HEAL` use the default 20% change when no amount is provided. When the software side needs more control, send an amount from `1` to `100`, for example `DAMAGE 10`.

`DESPERATE` is handled by the Arduino automatically when health drops below 50%, so the software side normally should not send it directly.

## Next Software Integration Step

`index.js` is currently a terminal test bridge. It proves that Node.js can open the serial port, send commands to Arduino, and read Arduino responses.

For the real app, move the serial-port logic into the Express server so API routes can control the Arduino:

1. Install `serialport` in the `server` folder.
2. Create a helper such as `server/arduino.js`.
3. Open the Arduino port once when the server starts.
4. Export a function such as `sendArduinoCommand(command)`.
5. Add an Express route such as `POST /api/arduino/command`.
6. Have the frontend or app logic call that route with commands like `DAMAGE 15`, `HEAL 10`, `RESET`, or `BOTHER`.

The final flow should be:

```txt
Frontend or app logic
  -> Express API
  -> server/arduino.js
  -> Arduino serial command
  -> LCD/buzzer/button response
```

Close Arduino Serial Monitor before starting the Node/Express serial connection. The serial port can only be opened by one program at a time.

## Hardware Notes

- LCD pins: `RS=6`, `E=7`, `D4=5`, `D5=4`, `D6=3`, `D7=2`
- Buzzer pin: `10`
- Push button pin: `9`
- The button uses `INPUT_PULLUP`, so wire the button between pin 9 and GND.
