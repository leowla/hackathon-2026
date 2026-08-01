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

## Serial protocol

One newline-terminated signal per line, 9600 baud. Commands are
case-insensitive.

```
COMMAND
COMMAND:AMOUNT
```

`DAMAGE` and `HEAL` accept an amount, which is the number of health points to
apply. `DEATH`, `RESET`, `BOTHER` and `DESPERATE` take none.

| Sent | Effect |
| --- | --- |
| `DAMAGE:35` | Lose 35 health |
| `HEAL:15` | Gain 15 health |
| `DAMAGE` | Lose the built-in 20, as before |
| `RESET` | Back to 100 with the heart animation |
| `BOTHER` | Attention sound, no health change |

An omitted, empty or non-numeric amount (`DAMAGE`, `DAMAGE:`, `DAMAGE:abc`)
falls back to the built-in 20 point step, so every command that worked before
still works. An amount above 100 is clamped; an amount of `0` is accepted and
reported as ignored.

Dropping below 50 health still auto-triggers the `DESPERATE` alarm, which
repeats until the push button is pressed. Because the amount is now
sender-controlled, a single large hit can cross that threshold. The Arduino
raises `DESPERATE` on its own, so the software side normally should not send
it directly.

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

## Driving it from the server

`server/arduino.js` owns the same serial link and is what the app actually
uses. Configure it in `server/.env`:

```
ARDUINO_PORT=COM3
ARDUINO_BAUD=9600
```

Find the port on Windows with `[System.IO.Ports.SerialPort]::getportnames()`
in PowerShell, or in the Arduino IDE under **Tools > Port**. Leave
`ARDUINO_PORT` unset and the server runs normally with the hardware disabled.

Only one process can hold the port. While the server is running,
`node index.js` and the Arduino Serial Monitor will fail to open it, and vice
versa.

Send a signal by hand while the server is up:

```bash
curl -X POST localhost:3321/api/arduino \
  -H "Content-Type: application/json" \
  -d '{"command":"DAMAGE","amount":30}'
```

## Hardware Notes

- LCD pins: `RS=6`, `E=7`, `D4=5`, `D5=4`, `D6=3`, `D7=2`
- Buzzer pin: `10`
- Push button pin: `9`
- The button uses `INPUT_PULLUP`, so wire the button between pin 9 and GND.
