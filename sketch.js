/**
 * sketch.js
 * Boundary X Voice Controller Logic
 */

const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let rxCharacteristic = null;
let isConnected = false;
let bluetoothStatus = "연결 대기 중"; 

let recognition;
let transcript = ""; 
let recognitionStatus = "블루투스 연결 시 음성 인식이 준비됩니다."; 
let sentData = ""; 

let isRecognitionStarted = false; 
let isPressing = false;           
let lastCommandTime = 0;          

const voiceCommands = {
  forward: ["전진", "앞으로", "직진", "출발"],
  backward: ["뒤로", "후진"],
  stop: ["멈춰", "정지", "그만"],
  left: ["좌회전", "왼쪽", "좌측"],
  right: ["우회전", "오른쪽", "우측"],
  ring: ["사이렌", "소리", "경보"],
  name : ["이름", "너의 이름"],
  happy : ["안녕", "반가워"],
  angry : ["혼날래", "화났어"],
  dance : ["춤 춰", "춤춰", "댄스"]
};

let userCommands = {}; 

function setup() {
  noCanvas(); 
  createBluetoothUI();
  createCommandTable();
  createUserCommandUI();
  createVoiceRecognitionUI();
  setupVoiceRecognition(); 

  const excelInput = select("#excelInput");
  if(excelInput) {
    excelInput.elt.addEventListener('change', importCommandsFromExcel, false);
  }
}

function createBluetoothUI() {
  const statusElement = select("#bluetoothStatus");
  if (statusElement) statusElement.html(`상태: ${bluetoothStatus}`);

  const buttonContainer = select("#bluetooth-control-buttons");
  if (buttonContainer) {
    const connectButton = createButton("기기 연결").addClass("start-button");
    connectButton.mousePressed(connectBluetooth);
    buttonContainer.child(connectButton);

    const disconnectButton = createButton("연결 해제").addClass("stop-button");
    disconnectButton.mousePressed(disconnectBluetooth);
    buttonContainer.child(disconnectButton);
  }
}

function createCommandTable() {
  const tableContainer = select("#command-table-container");
  if (tableContainer) {
    tableContainer.html(''); 
    const table = createElement("table");
    tableContainer.child(table);

    const header = createElement("tr");
    header.child(createElement("th", "음성 명령 (Inputs)"));
    header.child(createElement("th", "전송 데이터 (Outputs)"));
    header.child(createElement("th", "삭제")); // 추가된 삭제 열
    table.child(header);

    Object.entries(voiceCommands).forEach(([command, phrases]) => {
      const row = createElement("tr");
      row.child(createElement("td", phrases.join(", ")));
      row.child(createElement("td", command));
      row.child(createElement("td", "")); // 기본 명령어는 빈 칸
      table.child(row);
    });
    updateCommandTable(); 
  }
}

function updateCommandTable() {
  const table = select("table");
  if (table) {
    table.html("");
    const header = createElement("tr");
    header.child(createElement("th", "음성 명령 (Inputs)"));
    header.child(createElement("th", "전송 데이터 (Outputs)"));
    header.child(createElement("th", "삭제")); // 추가된 삭제 열
    table.child(header);

    // 기본 명령어 렌더링 (삭제 버튼 없음)
    Object.entries(voiceCommands).forEach(([command, phrases]) => {
      const row = createElement("tr");
      row.child(createElement("td", phrases.join(", ")));
      row.child(createElement("td", command));
      row.child(createElement("td", "")); 
      table.child(row);
    });

    // 사용자 추가 명령어 렌더링 (삭제 버튼 포함)
    Object.entries(userCommands).forEach(([command, data]) => {
      const row = createElement("tr");
      row.child(createElement("td", command));
      row.child(createElement("td", data[0]));
      
      // X 버튼 생성 및 스타일링
      const deleteCell = createElement("td");
      const deleteBtn = createButton("X");
      deleteBtn.style('color', '#EA4335'); // 삭제 강조 (빨간색)
      deleteBtn.style('background', 'transparent');
      deleteBtn.style('border', 'none');
      deleteBtn.style('font-weight', 'bold');
      deleteBtn.style('font-size', '1rem');
      deleteBtn.style('cursor', 'pointer');
      
      // 버튼 클릭 시 객체에서 해당 명령어 지우고 테이블 새로고침
      deleteBtn.mousePressed(() => {
        delete userCommands[command]; 
        updateCommandTable(); 
      });
      
      deleteCell.child(deleteBtn);
      row.child(deleteCell);
      
      row.style('background-color', '#F1F8E9'); 
      table.child(row);
    });
  }
}

function createUserCommandUI() {
  const inputContainer = select("#user-command-ui");
  if (inputContainer) {
    const commandInput = createInput().attribute("placeholder", "새 명령어 (예: 춤춰)");
    inputContainer.child(commandInput);

    const dataInput = createInput().attribute("placeholder", "데이터 (예: DANCE)");
    inputContainer.child(dataInput);

    const addButton = createButton("추가").addClass("start-button");
    addButton.mousePressed(() => {
      const command = commandInput.value().trim();
      const data = dataInput.value().trim();
      if (command && data) {
        userCommands[command] = [data]; 
        updateCommandTable();
        commandInput.value("");
        dataInput.value("");
      } else {
        alert("명령어와 데이터를 모두 입력해주세요.");
      }
    });
    inputContainer.child(addButton);

    inputContainer.child(createElement('div').style('width','100%').style('height','10px'));

    const exportBtn = createButton("엑셀 내보내기").addClass("excel-button");
    exportBtn.mousePressed(exportCommandsToExcel);
    inputContainer.child(exportBtn);

    const importBtn = createButton("엑셀 불러오기").addClass("excel-button");
    importBtn.mousePressed(() => select("#excelInput").elt.click());
    inputContainer.child(importBtn);
  }
}

function exportCommandsToExcel() {
  if (Object.keys(userCommands).length === 0) {
    alert("저장할 사용자 명령어가 없습니다.");
    return;
  }
  const wsData = [["Command", "Data"]];
  Object.entries(userCommands).forEach(([key, val]) => {
    wsData.push([key, val[0]]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "UserCommands");
  XLSX.writeFile(wb, "commands_backup.xlsx");
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

function createVoiceRecognitionUI() {
  const container = select("#voice-recognition-ui");
  if (container) {
    container.html(''); 

    const micBtn = createButton("").addClass("mic-button");
    micBtn.html(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    `);
    
    const btnElt = micBtn.elt;

    const handleDown = (e) => {
      if(e.cancelable) e.preventDefault(); 
      if (!isConnected) {
        alert("먼저 블루투스를 연결해주세요.");
        return;
      }
      if (!isRecognitionStarted) {
        try { recognition.start(); isRecognitionStarted = true; } catch(err) {}
      }

      isPressing = true;
      micBtn.addClass('active');
      recognitionStatus = "듣고 있습니다...";
      transcript = ""; 
      displayRecognitionStatus();
    };

    const handleUp = (e) => {
      if(e.cancelable) e.preventDefault();
      micBtn.removeClass('active');
      
      recognitionStatus = "처리 중...";
      displayRecognitionStatus();

      setTimeout(() => {
        if (!micBtn.hasClass('active')) { 
          isPressing = false; 
          recognitionStatus = "대기 중";
          displayRecognitionStatus();
        }
      }, 800); 
    };

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

function displayRecognitionStatus() {
  const statusContainer = select("#status-container");
  if (statusContainer) {
    let statusDiv = select("#recognitionStatus");
    if (!statusDiv) {
      statusDiv = createDiv().id("recognitionStatus");
      statusDiv.parent(statusContainer);
    }
    statusDiv.html(recognitionStatus);

    let resultDiv = select("#recognitionResult");
    if (!resultDiv) {
      resultDiv = createDiv(`인식 결과: ${transcript}`).id("recognitionResult");
      resultDiv.parent(statusContainer);
    } else {
      resultDiv.html(`인식 결과: ${transcript}`);
    }
  }
}

function displaySentData() {
  const statusContainer = select("#status-container");
  if (statusContainer) {
    let sentDataDiv = select("#sentDataDisplay");
    if (!sentDataDiv) {
      sentDataDiv = createDiv(`전송 데이터: ${sentData || "-"}`).id("sentDataDisplay");
      sentDataDiv.parent(statusContainer);
    } else {
      sentDataDiv.html(`전송 데이터: ${sentData || "-"}`);
    }
  }
}

function setupVoiceRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "ko-KR";
    recognition.interimResults = true; 
    recognition.continuous = true;    

    recognition.onresult = (event) => {
      if (!isPressing) return;

      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      transcript = currentTranscript.trim();
      displayRecognitionStatus();

      if (Date.now() - lastCommandTime > 800) {
        if (checkAndSendCommand(transcript)) {
          lastCommandTime = Date.now();
          recognitionStatus = `명령어 감지됨: "${sentData}"`;
          displayRecognitionStatus();
          displaySentData();
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Error:", event.error);
      if (event.error === 'not-allowed') {
        recognitionStatus = "마이크 권한이 필요합니다.";
      } else {
        isRecognitionStarted = false; 
      }
      displayRecognitionStatus();
    };

    recognition.onend = () => {
      isRecognitionStarted = false;
      if (isPressing) {
          try { recognition.start(); isRecognitionStarted = true; } catch(e){}
      }
    };
  } else {
    alert("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 edge 브라우저를 사용해주세요.");
  }
}

function checkAndSendCommand(text) {
  for (const [key, data] of Object.entries(userCommands)) {
    if (text.includes(key)) {
      sendBluetoothData(data[0]);
      sentData = data[0];
      return true;
    }
  }
  for (const [key, phrases] of Object.entries(voiceCommands)) {
    if (phrases.some((phrase) => text.includes(phrase))) {
      sendBluetoothData(key);
      sentData = key;
      return true;
    }
  }
  return false;
}

// UI Color Update Logic
function updateBluetoothStatusUI(type) {
  const el = select("#bluetoothStatus");
  if (el) {
    el.removeClass("status-connected");
    el.removeClass("status-error");
    el.html(`상태: ${bluetoothStatus}`);

    if (type === 'connected') {
      el.addClass("status-connected");
    } else if (type === 'error') {
      el.addClass("status-error");
    }
  }
}

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
    
    // Connected (Green)
    bluetoothStatus = `${bluetoothDevice.name} 연결됨`;
    updateBluetoothStatusUI('connected');

    if (!isRecognitionStarted) {
        try {
            recognition.start();
            isRecognitionStarted = true;
        } catch (err) {}
    }
  } catch (error) {
    console.error("Connection failed", error);
    // Error (Red)
    bluetoothStatus = "연결 실패 (다시 시도해주세요)";
    updateBluetoothStatusUI('error');
  }
}

function disconnectBluetooth() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
  isConnected = false;
  bluetoothDevice = null;
  rxCharacteristic = null;
  
  // Default (Grey)
  bluetoothStatus = "연결 해제됨";
  updateBluetoothStatusUI('default');
  
  if(isRecognitionStarted) {
      try { recognition.stop(); isRecognitionStarted = false; } catch(e){}
  }
}

async function sendBluetoothData(data) {
  if (!rxCharacteristic || !isConnected) return;
  try {
    const encoder = new TextEncoder();
    await rxCharacteristic.writeValue(encoder.encode(`${data}\n`));
  } catch (e) {
    console.error("Send error:", e);
  }
}


