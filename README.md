# 🎤 Boundary X - AI Voice Recognition

**Boundary X AI Voice Recognition** is a web-based application that utilizes the **Web Speech API** to convert user voice commands into text and transmits mapped data to external hardware (e.g., BBC Micro:bit) via **Bluetooth Low Energy (BLE)**.

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Platform](https://img.shields.io/badge/Platform-Web-blue)
![Tech](https://img.shields.io/badge/Stack-p5.js%20%7C%20Web%20Bluetooth-yellow)

## ✨ Key Features

### 1. 🎙️ Real-time Voice Recognition (Web Speech API)
- Uses the browser's built-in API to recognize voice commands without needing a server.
- **Push-to-Talk Logic:** The app only listens while the microphone button is pressed and processes the command upon release, preventing accidental triggers.
- *Note: The default language is set to Korean (`ko-KR`).*

### 2. 🔗 Wireless Control (Web Bluetooth API)
- Connects directly to **BBC Micro:bit** (or other BLE devices).
- Utilizes the **Nordic UART Service** for stable serial communication.

### 3. 🛠️ Custom Command Management (Excel Support)
- **Default Commands:** Includes essential robot controls (Move, Stop, Turn, etc.).
- **User-Defined Commands:** Users can add their own custom words and mapping data via the web UI.
- **Excel Integration:** Powered by `SheetJS`, users can **Export** their command list to an `.xlsx` file for backup or **Import** pre-made lists, making it ideal for educational settings.

### 4. 📱 Responsive UI
- A "Modern Mono Tech" themed interface that adjusts seamlessly to PC, Tablet, and Mobile screens.

---

## 📡 Communication Protocol

When a voice command is recognized, the mapped **English string** is sent via Bluetooth. A newline character (`\n`) is automatically appended to every transmission.

### 1. Default Mapping Table

| Voice Command (Korean Input) | Sent Data (Output) |
| :--- | :--- |
| 전진 (Forward), 앞으로, 직진, 출발 | `forward` |
| 뒤로 (Backward), 후진 | `backward` |
| 멈춰 (Stop), 정지, 그만 | `stop` |
| 좌회전 (Left), 왼쪽, 좌측 | `left` |
| 우회전 (Right), 오른쪽, 우측 | `right` |
| 사이렌 (Siren), 소리, 경보 | `ring` |
| 이름 (Name), 너의 이름 | `name` |
| 안녕 (Hello), 반가워 | `happy` |
| 혼날래 (Angry), 화났어 | `angry` |
| 춤 춰 (Dance), 춤춰, 댄스 | `dance` |

### 2. Data Example
> User says: **"앞으로 (Forward)"**
> Data sent to hardware: `forward\n`

---

## 🛠 Tech Stack

* **Frontend:** HTML5, CSS3 (Pretendard Font)
* **Logic:** JavaScript (ES6+)
* **Libraries:**
    * [p5.js](https://p5js.org/): DOM manipulation and app structure.
    * [SheetJS (xlsx)](https://sheetjs.com/): Handling Excel file I/O.
* **Browser APIs:**
    * **Web Speech API:** Speech-to-Text conversion.
    * **Web Bluetooth API:** Hardware communication (Nordic UART Service).

**License:**
- Copyright © 2024 Boundary X Co. All rights reserved.
- All rights to the source code and design of this project belong to BoundaryX.
- Web: boundaryx.io
- Contact: https://boundaryx.io/contact
