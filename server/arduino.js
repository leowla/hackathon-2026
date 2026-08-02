import { SerialPort } from "serialport";

// The pet firmware reads one newline-terminated signal at a time, shaped as
// either "COMMAND" or "COMMAND:AMOUNT". Only DAMAGE and HEAL carry an amount;
// RESET, BOTHER and DEATH are always bare. Sending a bare DAMAGE or HEAL makes
// the board fall back to its own built-in 20 point step.
export const ARDUINO_COMMANDS = ["DAMAGE", "HEAL", "RESET", "BOTHER", "DEATH"];

const AMOUNT_COMMANDS = ["DAMAGE", "HEAL"];

const MIN_AMOUNT = 0;
const MAX_AMOUNT = 100;
const DEFAULT_BAUD_RATE = 9600;

// Opening the port toggles DTR, which reboots the board. Anything written
// during that window is lost, so hold sends until it has settled.
const READY_DELAY_MS = 2000;
const RECONNECT_DELAY_MS = 3000;

let port = null;
let ready = false;
let readyPromise = null;
let settleReady = null;
let reconnectTimer = null;
let closedByUs = false;
let receiveBuffer = "";
let connectHook = null;
let bindingOverride = null;

const lineHandlers = new Set();

/**
 * Turn a (command, amount) pair into the exact line to put on the wire.
 * Pure, so it can be checked without a board attached.
 * Throws on an unknown command or a non-numeric amount.
 */
export function buildSignal(command, amount = null) {
  const verb = String(command ?? "")
    .trim()
    .toUpperCase();

  if (!ARDUINO_COMMANDS.includes(verb)) {
    throw new Error(
      `Unknown Arduino command: "${command}". Use one of ${ARDUINO_COMMANDS.join(", ")}.`,
    );
  }

  if (amount === null || amount === undefined) {
    return `${verb}\n`;
  }

  if (!AMOUNT_COMMANDS.includes(verb)) {
    console.warn(`${verb} takes no amount, ignoring ${amount}.`);
    return `${verb}\n`;
  }

  const numeric = Number(amount);

  if (!Number.isFinite(numeric)) {
    throw new Error(`Amount for ${verb} must be a number, got: ${amount}`);
  }

  const clamped = Math.max(
    MIN_AMOUNT,
    Math.min(MAX_AMOUNT, Math.round(numeric)),
  );

  return `${verb}:${clamped}\n`;
}

/**
 * Send one signal to the pet.
 *
 * `amount` is nullable and only meaningful for DAMAGE and HEAL. A missing
 * board is not an error: the signal is dropped and reported, so the rest of
 * the server keeps working when nobody has the hardware plugged in.
 *
 * Resolves { sent, line, reason? }.
 */
export async function sendToArduino(command, amount = null) {
  const line = buildSignal(command, amount);

  const isReady = await waitForReady();

  if (!isReady) {
    console.warn(`Arduino not connected, dropped: ${line.trim()}`);
    return { sent: false, line, reason: "disconnected" };
  }

  return writeLine(line);
}

// Same as sendToArduino but without the ready gate, so the connect hook can
// talk to a board that has finished rebooting but is not open for business
// yet. Handing this to the hook keeps its signals ahead of anything that
// queued up while the board was away.
async function writeSignal(command, amount = null) {
  return writeLine(buildSignal(command, amount));
}

async function writeLine(line) {
  if (!port || !port.isOpen) {
    console.warn(`Arduino not connected, dropped: ${line.trim()}`);
    return { sent: false, line, reason: "disconnected" };
  }

  await new Promise((resolve, reject) => {
    port.write(line, (err) => (err ? reject(err) : resolve()));
  });

  await new Promise((resolve, reject) => {
    port.drain((err) => (err ? reject(err) : resolve()));
  });

  console.log(`Arduino <- ${line.trim()}`);
  return { sent: true, line };
}

/**
 * Open the serial port and keep it open, reconnecting if the board is
 * unplugged. Call once at boot. Without ARDUINO_PORT the whole module
 * becomes a no-op.
 *
 * `onConnect(send)` runs once the board has finished rebooting, which is the
 * moment to push any state the server holds onto a freshly reset pet. It is
 * handed its own `send(command, amount)` that bypasses the ready gate, so its
 * signals arrive before any that queued up during the reboot.
 *
 * `binding` swaps the serialport backend, which is only useful for exercising
 * this module against a fake board. Leave it alone in normal use.
 */
export function openArduino({ onConnect = null, binding = null } = {}) {
  const path = process.env.ARDUINO_PORT;

  if (!path) {
    console.log("Arduino serial disabled (ARDUINO_PORT not set).");
    return;
  }

  const baudRate = Number(process.env.ARDUINO_BAUD) || DEFAULT_BAUD_RATE;

  connectHook = onConnect;
  bindingOverride = binding;
  closedByUs = false;

  connect(path, baudRate);
}

export function closeArduino() {
  closedByUs = true;

  clearTimeout(reconnectTimer);
  reconnectTimer = null;

  if (port && port.isOpen) {
    port.close();
  }

  port = null;
  ready = false;
}

/**
 * Subscribe to lines coming back from the board, such as "BUTTON_PUSHED" or
 * the "DAMAGE accepted. Health: 70%" acknowledgements.
 * Returns an unsubscribe function.
 */
export function onArduinoLine(handler) {
  lineHandlers.add(handler);
  return () => lineHandlers.delete(handler);
}

function connect(path, baudRate) {
  resetReady();

  port = new SerialPort({
    path,
    baudRate,
    ...(bindingOverride ? { binding: bindingOverride } : {}),
  });

  port.on("open", () => {
    console.log(`Arduino connected on ${path} at ${baudRate} baud.`);

    setTimeout(async () => {
      if (!port || !port.isOpen) {
        return;
      }

      if (connectHook) {
        try {
          await connectHook(writeSignal);
        } catch (err) {
          console.error("Arduino connect hook failed:", err);
        }
      }

      // Only now release anything that piled up during the reboot.
      ready = true;
      settleReady(true);
    }, READY_DELAY_MS);
  });

  port.on("data", handleData);

  port.on("error", (err) => {
    console.error("Arduino serial error:", err.message);

    // A port that was never opened emits only "error", so the retry has to be
    // kicked off from here as well. Covers booting before the board is
    // plugged in.
    if (!port || !port.isOpen) {
      ready = false;
      settleReady(false);
      scheduleReconnect(path, baudRate);
    }
  });

  port.on("close", () => {
    console.log("Arduino connection closed.");

    ready = false;
    settleReady(false);
    receiveBuffer = "";

    scheduleReconnect(path, baudRate);
  });
}

function scheduleReconnect(path, baudRate) {
  if (closedByUs || reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log(`Reconnecting to the Arduino on ${path}...`);
    connect(path, baudRate);
  }, RECONNECT_DELAY_MS);

  // Do not hold the process open just to retry a missing board.
  reconnectTimer.unref?.();
}

function resetReady() {
  ready = false;
  readyPromise = new Promise((resolve) => {
    settleReady = resolve;
  });
}

// Resolves true once the board is usable, false if it went away first.
function waitForReady() {
  if (ready) {
    return Promise.resolve(true);
  }

  if (!port || !readyPromise) {
    return Promise.resolve(false);
  }

  return readyPromise;
}

function handleData(data) {
  receiveBuffer += data.toString();

  // The firmware answers with Serial.println, so split on line boundaries and
  // keep any trailing partial line for the next chunk.
  const lines = receiveBuffer.split(/\r?\n/);
  receiveBuffer = lines.pop() ?? "";

  for (const raw of lines) {
    const message = raw.trim();

    if (!message) {
      continue;
    }

    if (message.startsWith("ERROR:")) {
      console.error(`Arduino -> ${message}`);
    } else {
      console.log(`Arduino -> ${message}`);
    }

    for (const handler of lineHandlers) {
      try {
        handler(message);
      } catch (err) {
        console.error("Arduino line handler failed:", err);
      }
    }
  }
}
