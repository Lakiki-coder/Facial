# Real-Time AI Video Call with Face & Voice Replacement

A full-stack real-time video calling application with AI-powered face swapping and voice conversion capabilities.

## Architecture

```
User (Camera/Mic) 
    ↓
React Frontend (Port 3000)
    ↓
WebRTC Peer Connection
    ↓
Signaling Server - Socket.io (Port 3001)
    ↓
AI Backend - Spring Boot (Port 8080)
    ↓
Deep-Live-Cam (Face Swap) + RVC (Voice Conversion)
```

## Features

- ✅ Real-time video calls using WebRTC
- ✅ Face swapping using Deep-Live-Cam
- ✅ Voice conversion using RVC (Retrieval-based Voice Conversion)
- ✅ Room-based video conferencing
- ✅ AI control panel in the UI

## Project Structure

```
webrtc-test/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoCall.js     # Main video call component
│   │   │   ├── Room.js          # Room creation/joining
│   │   │   └── AIControlPanel.js # AI controls UI
│   │   └── utils/
│   │       └── aiProcessing.js  # AI WebSocket client
│   └── package.json
│
├── server/                    # Node.js Signaling Server
│   ├── https-server.js        # Express + Socket.io
│   ├── server.js
│   └── package.json
│
├── backend/                   # Spring Boot AI Backend
│   ├── src/main/java/com/aivideocall/
│   │   ├── service/
│   │   │   ├── FaceSwapService.java      # Deep-Live-Cam integration
│   │   │   └── VoiceConversionService.java # RVC integration
│   │   ├── websocket/
│   │   │   ├── AIProcessingHandler.java
│   │   │   └── VideoStreamHandler.java
│   │   └── controller/
│   │       └── AIController.java
│   └── pom.xml
│
├── Deep_Live_Project/
│   └── Deep-Live-Cam/        # Face swapping AI
│
├── docker-compose.yml         # All services orchestration
└── README.md
```

## Prerequisites

- Node.js 18+
- Java 17+
- Python 3.10+
- Docker & Docker Compose (optional)
- For GPU acceleration: NVIDIA GPU with CUDA

## Running the Application Between Two Users

### How It Works

The system uses a **client-server architecture**:

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   User A's      │         │   SERVER         │         │   User B's      │
│   Laptop        │◄───────►│  (Host this!)    │◄───────►│   Laptop        │
│                 │   WebRTC │                  │  WebRTC │                 │
│  - Browser      │         │  - Signaling     │         │  - Browser      │
│  - Camera/Mic   │         │  - AI Processing │         │  - Camera/Mic   │
└─────────────────┘         └──────────────────┘         └─────────────────┘

Server needs: 3000, 3001, 8080 ports open
```

**Key Point:** The SERVER must be accessible from both users' computers.

### Option 1: Deploy on a Server (Recommended for 2+ Users)

1. **On a server computer (or cloud):**
   
```
bash
   cd webrtc-test
   docker-compose up -d
   
```
   
2. **Get the server's IP address:**
   - Windows: `ipconfig` (look for IPv4 Address)
   - Linux/Mac: `ifconfig` or `ip addr`

3. **Update the frontend to connect to your server:**
   Edit `client/src/App.js` and change:
   
```
javascript
   const SERVER_URL = 'https://YOUR_SERVER_IP:3001';
   
```
   
4. **Rebuild and redeploy the frontend**

### Option 2: Local Network Testing (Same Network)

1. **On the host computer:**
   
```
bash
   # Get your local IP (e.g., 192.168.1.100)
   ipconfig    # Windows
   ifconfig    # Mac/Linux
   
   cd webrtc-test/server
   npm install
   node https-server.js
   
```

2. **On the SAME computer, start the AI backend:**
   
```
bash
   cd webrtc-test/backend
   ./mvnw spring-boot:run
   
```

3. **On User A's laptop (the host):**
   - Edit `client/src/App.js`:
     
```
javascript
     const SERVER_URL = 'https://192.168.1.100:3001';
     
```
   - Run the frontend:
     
```
bash
     cd webrtc-test/client
     npm install
     npm start
     
```
   - Open browser at http://localhost:3000

4. **On User B's laptop:**
   - Edit `client/src/App.js` with the SAME IP:
     
```
javascript
     const SERVER_URL = 'https://192.168.1.100:3001';
     
```
   - Run npm install and npm start
   - Open browser at http://localhost:3000

### Option 3: Using Docker Compose (Recommended for Server)

```
bash
cd webrtc-test
docker-compose up -d
```

This will start all services:
- Frontend: http://localhost:3000
- Signaling Server: https://localhost:3001
- AI Backend: http://localhost:8080

## How to Use

1. **Join/Create a Room**
   - Enter the app and either create a new room or join an existing one using a room ID

2. **Start Video Call**
   - Grant camera and microphone permissions when prompted
   - Share the room ID with others to join

3. **AI Face Swap**
   - Click the 🤖 (AI) button in the controls
   - Select a target face image from your computer
   - Toggle "Face Swap" to enable/disable

4. **AI Voice Conversion**
   - In the AI Control Panel, toggle "Voice Conversion" to enable voice changing

## API Endpoints

### AI Backend (Port 8080)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/health` | GET | Health check |
| `/api/ai/face-swap/load` | POST | Load a face image |
| `/api/ai/face-swap/enable` | POST | Enable/disable face swap |
| `/api/ai/voice-convert/load` | POST | Load a voice model |
| `/api/ai/voice-convert/enable` | POST | Enable/disable voice conversion |
| `/ws/ai-process` | WebSocket | Real-time frame processing |

### Signaling Server (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/rooms` | POST | Create a room |
| `/api/rooms/:roomId` | GET | Get room info |

## Environment Configuration

### Backend (application.yml)

```
yaml
ai:
  processing:
    deep-live-cam:
      path: "../../Deep_Live_Project/Deep-Live-Cam"
    rvc:
      path: "../../RVC-WebUI"
    target-face-path: "./faces"
    voice-model-path: "./models/voices"
    frame-width: 640
    frame-height: 480
    target-fps: 20

websocket:
  allowed-origins: "*"
```

### Frontend (App.js)

```
javascript
const SERVER_URL = 'https://172.16.0.125:3001';
```

**Note:** Update the IP address to your server's IP for production.

## Troubleshooting

### Camera Access Denied
- Click the camera icon in the browser address bar
- Select "Allow" for camera and microphone

### WebRTC Connection Issues
- Ensure you're using HTTPS (or localhost for development)
- Check firewall settings for ports 3000, 3001, 8080

### AI Processing Slow
- Use GPU acceleration (requires NVIDIA GPU)
- Reduce video resolution in constraints

## Technologies Used

| Component | Technology |
|-----------|------------|
| Frontend | React, Tailwind CSS |
| WebRTC | Simple-peer, Socket.io |
| Backend | Spring Boot, Java 17 |
| Face Swap | Deep-Live-Cam |
| Voice Conversion | RVC (Retrieval-based Voice Conversion) |

## License

MIT License - See LICENSE file for details
