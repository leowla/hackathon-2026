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

## Hardware Notes

- LCD pins: `RS=6`, `E=7`, `D4=5`, `D5=4`, `D6=3`, `D7=2`
- Buzzer pin: `10`
- Push button pin: `9`
- The button uses `INPUT_PULLUP`, so wire the button between pin 9 and GND.
