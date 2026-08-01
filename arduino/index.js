const { SerialPort } = require("serialport");
const readline = require("node:readline");

// Arduino IDE의 Tools → Port에 표시되는 값으로 변경하세요.
const ARDUINO_PORT = "/dev/cu.usbmodem1301";
const BAUD_RATE = 9600;

const validCommands = [
  "DAMAGE",
  "HEAL",
  "DEATH",
  "RESET",
  "BOTHER",
];

// Arduino 연결
const port = new SerialPort({
  path: ARDUINO_PORT,
  baudRate: BAUD_RATE,
});

// 터미널 입력 인터페이스
const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Command > ",
});

let arduinoReady = false;
let receiveBuffer = "";

// Arduino 연결 성공
port.on("open", () => {
  console.log(`Arduino connected: ${ARDUINO_PORT}`);

  // 연결 직후에는 잠시 기다린 뒤 입력 허용
  setTimeout(() => {
    arduinoReady = true;

    console.log("\nAvailable commands:");
    console.log("  DAMAGE  - Reduce health");
    console.log("  HEAL    - Restore health");
    console.log("  DEATH   - Set health to 0");
    console.log("  RESET   - Start again at 100%");
    console.log("  BOTHER  - Play attention sound");
    console.log("  EXIT    - Close the program\n");

    terminal.prompt();
  }, 2000);
});

// Arduino가 보내는 응답 처리
port.on("data", (data) => {
  receiveBuffer += data.toString();

  // Arduino의 Serial.println() 응답을 줄 단위로 처리
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

// Serial 연결 오류
port.on("error", (error) => {
  console.error("\nSerial connection error:");
  console.error(error.message);
});

// Arduino 연결 종료
port.on("close", () => {
  console.log("\nArduino connection closed.");
});

// 터미널에 입력된 명령 처리
terminal.on("line", (input) => {
  const command = input.trim().toUpperCase();

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

  if (!validCommands.includes(command)) {
    console.log(`ERROR: "${command}" is not a valid command.`);
    console.log(
      "Use DAMAGE, HEAL, DEATH, RESET, BOTHER, or EXIT."
    );
    terminal.prompt();
    return;
  }

  sendCommand(command);
});

// Arduino로 명령 보내기
function sendCommand(command) {
  // Arduino의 readStringUntil('\n')에 맞춰 newline 추가
  port.write(`${command}\n`, (error) => {
    if (error) {
      console.error(`Failed to send ${command}: ${error.message}`);
      terminal.prompt();
      return;
    }

    console.log(`Sent: ${command}`);
    terminal.prompt();
  });
}

// 프로그램 안전하게 종료
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

// Control + C 처리
terminal.on("SIGINT", () => {
  closeProgram();
});