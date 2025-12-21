// Bluetooth UUIDs for micro:bit UART service
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let rxCharacteristic = null;
let isConnected = false;
let bluetoothStatus = "Disconnected";

let recognition;
let transcript = ""; 
let recognitionStatus = "버튼을 누르고 말을 하세요."; 
let feedbackEmoji = "👆"; 
let sentData = ""; 

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
  noCanvas(); // 캔버스 사용 안함 (p5.js 요소 제어만 사용)

  createBluetoothUI();
  createCommandTable();
  createUserCommandUI();
  createVoiceRecognitionUI();
  setupVoiceRecognition();

  // 엑셀 파일 입력 변경 감지 리스너
  select("#excelInput").elt.addEventListener('change', importCommandsFromExcel, false);
}

/**
 * 블루투스 연결 UI 생성
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
 * 음성 인식 데이터 표 생성
 */
function createCommandTable() {
  const tableContainer = select("#command-table-container");
  if (tableContainer) {
    tableContainer.html(''); // 초기화
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
    
    // 사용자 명령어는 updateCommandTable()에서 처리됨
    updateCommandTable(); 
  }
}

/**
 * 사용자 명령어 추가 UI & 엑셀 기능 버튼
 */
function createUserCommandUI() {
  const inputContainer = select("#user-command-ui");
  if (inputContainer) {
    const commandInput = createInput().attribute("placeholder", "새 음성 명령 (예: 춤춰)");
    inputContainer.child(commandInput);

    const dataInput = createInput().attribute("placeholder", "전송 데이터 (예: DANCE)");
    inputContainer.child(dataInput);

    // 추가 버튼
    const addButton = createButton("➕ 추가").addClass("start-button");
    addButton.style('width', '20%');
    addButton.mousePressed(() => {
      const command = commandInput.value().trim();
      const data = dataInput.value().trim();
      if (command && data) {
        userCommands[command] = [data]; // 배열 형태로 저장
        updateCommandTable();
        commandInput.value("");
        dataInput.value("");
      } else {
        alert("내용을 입력해주세요.");
      }
    });
    inputContainer.child(addButton);

    // 줄바꿈용 (flex wrap)
    const breakLine = createDiv('').style('width', '100%').style('height', '10px');
    inputContainer.child(breakLine);

    // 엑셀 내보내기 버튼
    const exportBtn = createButton("📥 엑셀 저장").addClass("excel-button");
    exportBtn.mousePressed(exportCommandsToExcel);
    inputContainer.child(exportBtn);

    // 엑셀 불러오기 버튼
    const importBtn = createButton("📤 엑셀 불러오기").addClass("excel-button");
    importBtn.mousePressed(() => {
      select("#excelInput").elt.click(); // 숨겨진 input file 트리거
    });
    inputContainer.child(importBtn);
  }
}

/**
 * 명령어 테이블 업데이트 (화면 갱신)
 */
function updateCommandTable() {
  const table = select("table");
  if (table) {
    table.html("");
    const header = createElement("tr");
    header.child(createElement("th", "음성 명령"));
    header.child(createElement("th", "전송 데이터"));
    table.child(header);

    // 기본 명령어 표시
    Object.entries(voiceCommands).forEach(([command, phrases]) => {
      const row = createElement("tr");
      row.child(createElement("td", phrases.join(", ")));
      row.child(createElement("td", command));
      table.child(row);
    });

    // 사용자 명령어 표시
    Object.entries(userCommands).forEach(([command, data]) => {
      const row = createElement("tr");
      row.child(createElement("td", command));
      row.child(createElement("td", data[0]));
      row.style('background-color', '#fff9c4'); // 사용자 추가 항목 강조
      table.child(row);
    });
  }
}

/**
 * [NEW] 엑셀 내보내기 기능
 */
function exportCommandsToExcel() {
  if (Object.keys(userCommands).length === 0) {
    alert("내보낼 사용자 명령어가 없습니다.");
    return;
  }

  // 데이터 포맷 변환 (Header + Data)
  const wsData = [["Command", "Data"]];
  Object.entries(userCommands).forEach(([key, val]) => {
    wsData.push([key, val[0]]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "UserCommands");

  // 파일 다운로드
  XLSX.writeFile(wb, "my_commands.xlsx");
}

/**
 * [NEW] 엑셀 불러오기 기능
 */
function importCommandsFromExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // JSON 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 첫 행(헤더) 제외하고 데이터 파싱
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
    select("#excelInput").value(""); // 초기화
  };
  reader.readAsArrayBuffer(file);
}


/**
 * [NEW] 음성 인식 제어 UI (Push-to-Talk)
 */
function createVoiceRecognitionUI() {
  const container = select("#voice-recognition-ui");
  if (container) {
    container.html(''); // 기존 버튼 제거

    // 원형 마이크 버튼 생성
    const micBtn = createButton("🎤").addClass("mic-button");
    
    // 마우스/터치 이벤트 등록
    const btnElt = micBtn.elt;

    // 누를 때 (Start)
    const startListening = (e) => {
      e.preventDefault(); // 모바일 터치 시 스크롤 방지
      if (!isConnected) {
        alert("먼저 블루투스를 연결해주세요!");
        return;
      }
      micBtn.addClass('active');
      feedbackEmoji = "👂";
      recognitionStatus = "듣고 있어요...";
      displayRecognitionStatus();
      
      try {
        recognition.start();
      } catch (err) {
        console.log("Already started", err);
      }
    };

    // 뗄 때 (Stop & Send)
    const stopListening = (e) => {
      e.preventDefault();
      micBtn.removeClass('active');
      feedbackEmoji = "📤";
      recognitionStatus = "분석 중...";
      displayRecognitionStatus();

      try {
        recognition.stop(); 
        // stop()을 호출하면 잠시 후 'onresult' -> 'onend'가 트리거 되며 데이터가 처리됨
      } catch (err) {
        console.log("Already stopped", err);
      }
    };

    // 이벤트 바인딩
    btnElt.addEventListener('mousedown', startListening);
    btnElt.addEventListener('mouseup', stopListening);
    btnElt.addEventListener('mouseleave', stopListening); // 버튼 밖으로 나가면 중지

    // 모바일 터치 지원
    btnElt.addEventListener('touchstart', startListening, { passive: false });
    btnElt.addEventListener('touchend', stopListening, { passive: false });
    
    container.child(micBtn);
    displayRecognitionStatus();
    displaySentData();
  }
}

/**
 * 상태 표시
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
 * [UPDATE] 음성 인식 설정 (단발성 인식으로 변경)
 */
function setupVoiceRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "ko-KR";
    recognition.interimResults = true; // 말하는 도중에도 결과를 보기 위해 true
    recognition.continuous = false;    // 버튼 떼면 바로 끝내기 위해 false

    recognition.onresult = (event) => {
      // interimResults가 true이므로 계속 갱신됨
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          // 중간 결과 표시
          transcript = event.results[i][0].transcript;
          displayRecognitionStatus();
        }
      }

      if (finalTranscript) {
        transcript = finalTranscript.trim();
        handleVoiceCommand(transcript); // 최종 결과일 때만 명령 처리
        displayRecognitionStatus();
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Error:", event.error);
      recognitionStatus = "오류 발생: " + event.error;
      displayRecognitionStatus();
    };

    recognition.onend = () => {
      // 인식이 완전히 끝났을 때
      console.log("Recognition ended");
      select(".mic-button").removeClass("active"); // 혹시 남아있을 active 제거
    };

  } else {
    alert("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬 브라우저를 사용하세요.");
  }
}

/**
 * 명령 처리 로직
 */
function handleVoiceCommand(command) {
  // 1. 사용자 명령 우선 검색
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

  // 2. 기본 명령 검색
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
 * 블루투스 관련 함수들 (기존 유지)
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