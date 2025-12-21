// Bluetooth UUIDs for micro:bit UART service
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let rxCharacteristic = null;
let isConnected = false;
let bluetoothStatus = "Disconnected";

// 음성 인식 관련 전역 변수
let recognition;
let transcript = ""; 
let recognitionStatus = "블루투스를 연결하면 음성 인식이 준비됩니다."; 
let feedbackEmoji = "👆"; 
let sentData = ""; 

// 로직 제어용 플래그
let isRecognitionStarted = false; // 음성 인식 엔진이 켜져있는지 여부
let isPressing = false;           // 사용자가 버튼을 누르고 있는지 여부

const voiceCommands = {
  forward: ["전진", "앞으로", "직진", "출발"],
  backward: ["뒤로", "후진"],
  stop: ["멈춰", "정지", "그만"],
  left: ["좌회전", "왼쪽", "좌측", "좌로", "반시계"],
  right: ["우회전", "오른쪽", "우측", "으로", "시계"],
  ring: ["사이렌", "소리", "부저", "경보음"]
};

let userCommands = {}; 

function setup() {
  console.log("Setup function called"); 
  noCanvas(); // p5.js 캔버스 미사용

  createBluetoothUI();
  createCommandTable();
  createUserCommandUI();
  createVoiceRecognitionUI();
  setupVoiceRecognition();

  // 엑셀 파일 입력 변경 감지 리스너
  const excelInput = select("#excelInput");
  if(excelInput) {
    excelInput.elt.addEventListener('change', importCommandsFromExcel, false);
  }
}

/**
 * [1] 블루투스 연결 UI 생성
 */
function createBluetoothUI() {
  const statusElement = select("#bluetoothStatus");
  if (statusElement) statusElement.html(`상태: ${bluetoothStatus}`);

  const buttonContainer = select("#bluetooth-control-buttons");
  if (buttonContainer) {
    const connectButton = createButton("🔗 블루투스 연결").addClass("start-button");
    connectButton.mousePressed(connectBluetooth);
    buttonContainer.child(connectButton);

    const disconnectButton = createButton("❌ 연결 해제").addClass("stop-button");
    disconnectButton.mousePressed(disconnectBluetooth);
    buttonContainer.child(disconnectButton);
  }
}

/**
 * [2] 음성 인식 데이터 표 생성
 */
function createCommandTable() {
  const tableContainer = select("#command-table-container");
  if (tableContainer) {
    tableContainer.html(''); 
    const table = createElement("table");
    tableContainer.child(table);

    const header = createElement("tr");
    header.child(createElement("th", "음성 명령"));
    header.child(createElement("th", "전송 데이터"));
    table.child(header);

    // 기본 명령어
    Object.entries(voiceCommands).forEach(([command, phrases]) => {
      const row = createElement("tr");
      row.child(createElement("td", phrases.join(", ")));
      row.child(createElement("td", command));
      table.child(row);
    });
    
    updateCommandTable(); 
  }
}

/**
 * [3] 사용자 명령어 추가 UI & 엑셀 기능
 */
function createUserCommandUI() {
  const inputContainer = select("#user-command-ui");
  if (inputContainer) {
    const commandInput = createInput().attribute("placeholder", "새 음성 명령 (예: 춤춰)");
    inputContainer.child(commandInput);

    const dataInput = createInput().attribute("placeholder", "전송 데이터 (예: DANCE)");
    inputContainer.child(dataInput);

    const addButton = createButton("➕ 추가").addClass("start-button");
    addButton.style('width', '20%');
    addButton.mousePressed(() => {
      const command = commandInput.value().trim();
      const data = dataInput.value().trim();
      if (command && data) {
        userCommands[command] = [data]; 
        updateCommandTable();
        commandInput.value("");
        dataInput.value("");
      } else {
        alert("내용을 입력해주세요.");
      }
    });
    inputContainer.child(addButton);

    const breakLine = createDiv('').style('width', '100%').style('height', '10px');
    inputContainer.child(breakLine);

    // 엑셀 내보내기
    const exportBtn = createButton("📥 엑셀 저장").addClass("excel-button");
    exportBtn.mousePressed(exportCommandsToExcel);
    inputContainer.child(exportBtn);

    // 엑셀 불러오기
    const importBtn = createButton("📤 엑셀 불러오기").addClass("excel-button");
    importBtn.mousePressed(() => {
      select("#excelInput").elt.click(); 
    });
    inputContainer.child(importBtn);
  }
}

function updateCommandTable() {
  const table = select("table");
  if (table) {
    table.html("");
    const header = createElement("tr");
    header.child(createElement("th", "음성 명령"));
    header.child(createElement("th", "전송 데이터"));
    table.child(header);

    Object.entries(voiceCommands).forEach(([command, phrases]) => {
      const row = createElement("tr");
      row.child(createElement("td", phrases.join(", ")));
      row.child(createElement("td", command));
      table.child(row);
    });

    Object.entries(userCommands).forEach(([command, data]) => {
      const row = createElement("tr");
      row.child(createElement("td", command));
      row.child(createElement("td", data[0]));
      row.style('background-color', '#fff9c4'); 
      table.child(row);
    });
  }
}

/**
 * 엑셀 내보내기/가져오기 로직
 */
function exportCommandsToExcel() {
  if (Object.keys(userCommands).length === 0) {
    alert("내보낼 사용자 명령어가 없습니다.");
    return;
  }
  const wsData = [["Command", "Data"]];
  Object.entries(userCommands).forEach(([key, val]) => {
    wsData.push([key, val[0]]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "UserCommands");
  XLSX.writeFile(wb, "my_commands.xlsx");
}

function importCommandsFromExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    let count = 0;
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row[0] && row[1]) {
        userCommands[row[0]] = [String(row[1])];
        count++;
      }
    }
    alert(`${count}개의 명령어를 불러왔습니다.`);
    updateCommandTable();
    select("#excelInput").value("");
  };
  reader.readAsArrayBuffer(file);
}

/**
 * [4] 음성 인식 제어 UI (Push-to-Talk & Always On Logic)
 */
function createVoiceRecognitionUI() {
  const container = select("#voice-recognition-ui");
  if (container) {
    container.html(''); 

    const micBtn = createButton("🎤").addClass("mic-button");
    const btnElt = micBtn.elt;

    // --- 버튼 누름 (데이터 수집 시작) ---
    const handleDown = (e) => {
      if(e.cancelable) e.preventDefault(); // 모바일 스크롤 방지
      
      if (!isConnected) {
        alert("먼저 블루투스를 연결해주세요! 연결 시 마이크가 자동 활성화됩니다.");
        return;
      }

      // 만약 어떤 이유로 엔진이 꺼져있다면 재시작 시도
      if (!isRecognitionStarted) {
        try { recognition.start(); isRecognitionStarted = true; } catch(err) { console.log(err); }
      }

      isPressing = true; // 플래그 ON: 이제부터 들리는 소리는 명령어로 처리함
      
      micBtn.addClass('active');
      feedbackEmoji = "👂";
      recognitionStatus = "듣고 있어요... (말하세요!)";
      transcript = ""; // 이전 결과 초기화
      displayRecognitionStatus();
    };

    // --- 버튼 뗌 (데이터 수집 종료) ---
    const handleUp = (e) => {
      if(e.cancelable) e.preventDefault();
      
      isPressing = false; // 플래그 OFF: 이제 소리 무시
      
      micBtn.removeClass('active');
      feedbackEmoji = "✅";
      // *중요* recognition.stop()을 호출하지 않음 (계속 켜둠)
      
      // UI 상태 복구
      setTimeout(() => {
        if (!isPressing) { 
            recognitionStatus = "대기 중...";
            displayRecognitionStatus();
        }
      }, 1500);
    };

    // 마우스/터치 이벤트 바인딩
    btnElt.addEventListener('mousedown', handleDown);
    btnElt.addEventListener('mouseup', handleUp);
    btnElt.addEventListener('mouseleave', handleUp); 

    btnElt.addEventListener('touchstart', handleDown, { passive: false });
    btnElt.addEventListener('touchend', handleUp, { passive: false });
    
    container.child(micBtn);
    displayRecognitionStatus();
    displaySentData();
  }
}

/**
 * 상태 표시 UI 업데이트
 */
function displayRecognitionStatus() {
  const statusContainer = select("#status-container");
  if (statusContainer) {
    let statusDiv = select("#recognitionStatus");
    if (!statusDiv) {
      statusDiv = createDiv().id("recognitionStatus").addClass("control-group");
      statusDiv.parent(statusContainer);
    }
    statusDiv.html(`${feedbackEmoji} ${recognitionStatus}`);

    let resultDiv = select("#recognitionResult");
    if (!resultDiv) {
      resultDiv = createDiv(`🧠 결과: ${transcript}`).id("recognitionResult").addClass("control-group");
      resultDiv.parent(statusContainer);
    } else {
      resultDiv.html(`🧠 결과: ${transcript}`);
    }
  }
}

function displaySentData() {
  const statusContainer = select("#status-container");
  if (statusContainer) {
    let sentDataDiv = select("#sentDataDisplay");
    if (!sentDataDiv) {
      sentDataDiv = createDiv(`📨 전송 데이터: ${sentData || "-"}`).id("sentDataDisplay").addClass("control-group");
      sentDataDiv.parent(statusContainer);
    } else {
      sentDataDiv.html(`📨 전송 데이터: ${sentData || "-"}`);
    }
  }
}

/**
 * [5] 음성 인식 엔진 설정 (Continuous Mode)
 */
function setupVoiceRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "ko-KR";
    recognition.interimResults = true; // 말하는 도중 결과 받기
    recognition.continuous = true;     // [핵심] 끊기지 않고 계속 듣기

    recognition.onresult = (event) => {
      // [핵심] 버튼을 누르고 있지 않으면(isPressing == false) 결과 무시
      if (!isPressing) return;

      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          transcript = event.results[i][0].transcript; // 중간 결과 표시
          displayRecognitionStatus();
        }
      }

      if (finalTranscript) {
        transcript = finalTranscript.trim();
        handleVoiceCommand(transcript); // 명령 처리
        displayRecognitionStatus();
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Error:", event.error);
      if (event.error === 'not-allowed') {
        recognitionStatus = "⚠️ 마이크 권한을 허용해주세요.";
      } else {
        isRecognitionStarted = false; // 에러 시 상태 초기화
      }
      displayRecognitionStatus();
    };

    recognition.onend = () => {
      console.log("Recognition ended naturally");
      isRecognitionStarted = false;
      // 만약 사용자가 버튼을 누르는 중인데 끊겼다면 즉시 재시작
      if (isPressing) {
          try { recognition.start(); isRecognitionStarted = true; } catch(e){}
      }
    };

  } else {
    alert("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬(Chrome) 또는 엣지(edge) 브라우저를 사용하세요.");
  }
}

/**
 * 명령 처리 로직
 */
function handleVoiceCommand(command) {
  // 1. 사용자 명령 우선
  for (const [key, data] of Object.entries(userCommands)) {
    if (command.includes(key)) {
      sendBluetoothData(data[0]);
      sentData = data[0];
      feedbackEmoji = "✅";
      recognitionStatus = `"${key}" 인식 성공!`;
      displaySentData();
      return;
    }
  }
  // 2. 기본 명령
  for (const [key, phrases] of Object.entries(voiceCommands)) {
    if (phrases.some((phrase) => command.includes(phrase))) {
      sendBluetoothData(key);
      sentData = key;
      feedbackEmoji = "✅";
      recognitionStatus = `"${key}" 인식 성공!`;
      displaySentData();
      return;
    }
  }
  
  feedbackEmoji = "❓";
  recognitionStatus = "알 수 없는 명령입니다.";
}

/**
 * [6] 블루투스 연결 (마이크 예열 포함)
 */
async function connectBluetooth() {
  try {
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "BBC micro:bit" }],
      optionalServices: [UART_SERVICE_UUID],
    });
    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(UART_SERVICE_UUID);
    rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
    isConnected = true;
    bluetoothStatus = `Connected to ${bluetoothDevice.name}`;

    // === [핵심] 연결 성공 시 마이크 엔진 몰래 켜기 (Warm-up) ===
    if (!isRecognitionStarted) {
        try {
            recognition.start();
            isRecognitionStarted = true;
            console.log("🎤 마이크 엔진이 백그라운드에서 예열되었습니다.");
        } catch (err) {
            console.log("마이크 시작 오류 (이미 켜져있을 수 있음):", err);
        }
    }
    // ========================================================

  } catch (error) {
    console.error("Connection failed", error);
    bluetoothStatus = "Connection Failed";
  }
  updateBluetoothStatus();
}

function disconnectBluetooth() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
  isConnected = false;
  bluetoothStatus = "Disconnected";
  bluetoothDevice = null;
  rxCharacteristic = null;
  
  // 블루투스 끊으면 마이크도 꺼서 배터리 절약 (선택사항)
  if(isRecognitionStarted) {
      try { recognition.stop(); isRecognitionStarted = false; } catch(e){}
  }
  
  updateBluetoothStatus();
}

function updateBluetoothStatus() {
  const el = select("#bluetoothStatus");
  if (el) {
    el.html(`상태: ${bluetoothStatus}`);
    el.style("background-color", isConnected ? "#d0f0fd" : "#f9f9f9");
  }
}

async function sendBluetoothData(data) {
  if (!rxCharacteristic || !isConnected) return;
  try {
    const encoder = new TextEncoder();
    await rxCharacteristic.writeValue(encoder.encode(`${data}\n`));
    console.log("Sent:", data);
  } catch (e) {
    console.error("Send error:", e);
  }
}
