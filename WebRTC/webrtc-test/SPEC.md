# Real-Time AI Video Call - Technical Specification

## 1. Project Overview

**Project Name:** AI Video Call with Face & Voice Replacement  
**Project Type:** Real-time WebRTC Video Communication with AI Processing  
**Core Functionality:** Enable users to have video calls with real-time face swapping and voice conversion  
**Target Users:** Content creators, streamers, privacy-conscious users, entertainment applications

---

## 2. High-Level Architecture

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER 1                                                │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐  │
│  │   Browser   │───▶│   React Client   │───▶│  Java Backend   │───▶│  Deep-Live-Cam  │  │
│  │ (Camera/Mic)│    │  (WebRTC + WS)  │    │ (AI Processor)  │    │  (Face Swap)    │  │
│  └─────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘  │
│         │                    │                       │                        │              │
│         │                    │                       │                        │              │
│         ▼                    ▼                       ▼                        ▼              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              WebRTC Peer Connection                                  │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                                   │
│                                        ▼                                                   │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐  │
│  │   Browser   │◀───│   React Client   │◀───│  Java Backend   │◀───│  RVC Server      │  │
│  │ (Display)   │    │  (WebRTC + WS)  │    │ (Voice Process) │    │  (Voice Swap)    │  │
│  └─────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘  │
│                                    USER 2                                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    VIDEO PIPELINE                                         │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│  1. CAPTURE                 2. SEND TO BACKEND              3. AI PROCESSING            │
│  ┌─────────────┐           ┌──────────────────┐           ┌─────────────────┐           │
│  │ getUserMedia│           │  WebSocket       │           │  Deep-Live-Cam  │           │
│  │ (640x480)   │──────────▶│  (Binary Frame)  │──────────▶│  Face Detection │           │
│  └─────────────┘           └──────────────────┘           │  Face Swap      │           │
│        │                                                   └─────────────────┘           │
│        │                                                           │                       │
│        │                                                           ▼                       │
│        │ 8. DISPLAY               7. RECEIVE              4. RETURN FRAME                 │
│  ┌─────────────┐           ┌──────────────────┐           ┌─────────────────┐           │
│  │ <video>     │◀──────────│  MediaStream     │◀──────────│  WebSocket      │           │
│  │ Element     │           │  Reconstruction  │           │  (Processed)    │           │
│  └─────────────┘           └──────────────────┘           └─────────────────┘           │
│                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AUDIO PIPELINE                                          │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│  1. CAPTURE                 2. SEND TO BACKEND              3. AI PROCESSING            │
│  ┌─────────────┐           ┌──────────────────┐           ┌─────────────────┐           │
│  │ getUserMedia│           │  WebSocket       │           │  RVC Model      │           │
│  │ (Audio)     │──────────▶│  (Audio Chunk)   │──────────▶│  Voice Convert  │           │
│  └─────────────┘           └──────────────────┘           └─────────────────┘           │
│        │                                                   │                               │
│        │                                                   ▼                               │
│        │ 6. PLAY                  5. RECEIVE              4. RETURN AUDIO                  │
│  ┌─────────────┐           ┌──────────────────┐           ┌─────────────────┐           │
│  │ <audio>     │◀──────────│  AudioContext    │◀──────────│  WebSocket      │           │
│  │ Element     │           │  (Playback)      │           │  (Converted)    │           │
│  └─────────────┘           └──────────────────┘           └─────────────────┘           │
│                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend (Web)

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | 18.x | UI Components |
| Build Tool | Vite | 5.x | Development/Build |
| WebRTC | Simple-Peer | 1.x | Peer-to-peer video |
| Signaling | Socket.io Client | 4.x | Real-time communication |
| Media Processing | Canvas API | - | Frame capture/rendering |
| Audio Processing | Web Audio API | - | Audio chunk processing |
| Styling | TailwindCSS | 3.x | UI Styling |
| HTTP Client | Axios | 1.x | REST API calls |

### 3.2 Backend (Java)

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | Spring Boot | 3.x | REST API & WebSocket server |
| WebSocket | Spring WebSocket | - | Real-time frame streaming |
| Video Processing | OpenCV | 4.x | Image processing |
| Face Analysis | InsightFace | 0.7.3 | Face detection & analysis |
| Face Swapping | DeepFaceLive | - | Real-time face swap |
| Audio Processing | RVC (via Python subprocess) | - | Voice conversion |
| ML Inference | PyTorch | 2.x | AI model inference |
| Process Management | Java Process Builder | - | Run Python scripts |
| HTTP Client | OkHttp / RestTemplate | - | External API calls |
| JSON Processing | Jackson | - | Serialization |

### 3.3 Infrastructure

| Component | Specification |
|-----------|---------------|
| GPU Server | NVIDIA T4/A10 (for AI processing) |
| Network | Low latency (<100ms recommended) |
| Protocol | WebSocket (frames), WebRTC (video) |
| Certificates | SSL/TLS for HTTPS |

---

## 4. Component Specifications

### 4.1 Frontend Components

#### 4.1.1 VideoCall Component (`VideoCall.js`)

**Responsibilities:**
- Manage WebRTC peer connections
- Capture local media stream
- Display remote streams
- Handle AI processing toggle
- Send/receive processed frames

**Key Methods:**
```
javascript
// Media capture
navigator.mediaDevices.getUserMedia(constraints)

// Send frames to AI backend
sendFrameToAI(frameData) {
  // Convert frame to blob
  // Send via WebSocket
}

// Handle processed frames
onAIFrameProcessed(processedFrame) {
  // Convert to MediaStream
  // Display or send via WebRTC
}
```

#### 4.1.2 AI Processing Hook (`useAIProcessing.js`)

**Responsibilities:**
- Manage WebSocket connection to AI backend
- Buffer frames for batch processing
- Handle latency optimization
- Cache processed frames

**Interface:**
```
javascript
const {
  connect,          // Connect to AI server
  disconnect,      // Disconnect
  processFrame,    // Send frame for processing
  onFrameProcessed, // Callback for processed frames
  latency,         // Current processing latency
  isProcessing     // Processing status
} = useAIProcessing(aiServerUrl);
```

### 4.2 Backend Components (Java)

#### 4.2.1 Spring Boot Application Structure

```
src/
├── main/
│   ├── java/com/aivideocall/
│   │   ├── AIVideoCallApplication.java
│   │   ├── config/
│   │   │   ├── WebSocketConfig.java
│   │   │   ├── CorsConfig.java
│   │   │   └── SecurityConfig.java
│   │   ├── controller/
│   │   │   ├── VideoController.java
│   │   │   ├── AudioController.java
│   │   │   └── ConfigController.java
│   │   ├── service/
│   │   │   ├── FaceSwapService.java
│   │   │   ├── VoiceConversionService.java
│   │   │   └── FrameProcessingService.java
│   │   ├── websocket/
│   │   │   ├── AIProcessingWebSocketHandler.java
│   │   │   └── VideoStreamHandler.java
│   │   ├── model/
│   │   │   ├── FaceSwapRequest.java
│   │   │   ├── FaceSwapResponse.java
│   │   │   └── ProcessingResult.java
│   │   └── util/
│   │       ├── ImageConverter.java
│   │       └── ProcessRunner.java
│   └── resources/
│       ├── application.yml
│       └── models/
│           └── (AI model files)
└── test/
```

#### 4.2.2 WebSocket Configuration

```
java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(aiProcessingHandler(), "/ws/ai-process")
                .setAllowedOrigins("*");
    }
    
    @Bean
    public AIProcessingWebSocketHandler aiProcessingHandler() {
        return new AIProcessingWebSocketHandler();
    }
}
```

#### 4.2.3 Face Swap Service

```
java
@Service
public class FaceSwapService {
    
    private Process pythonProcess;
    private BufferedReader processOutput;
    
    public byte[] processFrame(byte[] frameData, String targetFaceId) {
        // 1. Send frame to Python Deep-Live-Cam process
        // 2. Receive processed frame
        // 3. Return processed bytes
    }
    
    public void loadTargetFace(String imagePath) {
        // Load target face for swapping
    }
    
    public void setFaceSwapEnabled(boolean enabled) {
        // Toggle face swap
    }
}
```

#### 4.2.4 Voice Conversion Service

```
java
@Service
public class VoiceConversionService {
    
    private Process rvcProcess;
    
    public byte[] convertVoice(byte[] audioChunk, String targetVoiceId) {
        // 1. Send audio chunk to RVC
        // 2. Receive converted audio
        // 3. Return converted bytes
    }
    
    public void loadVoiceModel(String modelPath) {
        // Load voice conversion model
    }
}
```

---

## 5. API Specifications

### 5.1 REST Endpoints

#### 5.1.1 Configuration

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/ai/face/load` | Load target face image | `{ "imageUrl": "string" }` | `{ "faceId": "string", "status": "success" }` |
| GET | `/api/ai/face/list` | List available faces | - | `{ "faces": [{ "id": "string", "name": "string" }] }` |
| POST | `/api/ai/voice/load` | Load voice model | `{ "modelUrl": "string" }` | `{ "voiceId": "string", "status": "success" }` |
| GET | `/api/ai/voice/list` | List available voices | - | `{ "voices": [{ "id": "string", "name": "string" }] }` |
| POST | `/api/ai/toggle` | Toggle AI processing | `{ "faceSwap": boolean, "voiceConvert": boolean }` | `{ "status": "success" }` |

#### 5.1.2 Health & Status

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/health` | Server health check | `{ "status": "ok", "gpuAvailable": boolean, "modelsLoaded": boolean }` |
| GET | `/api/stats` | Processing statistics | `{ "fps": number, "latency": number, "activeConnections": number }` |

### 5.2 WebSocket Messages

#### 5.2.1 Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `frame` | `{ "data": "base64", "timestamp": number }` | Send video frame for processing |
| `audio` | `{ "data": "base64", "timestamp": number }` | Send audio chunk for conversion |
| `config` | `{ "faceId": "string", "voiceId": "string" }` | Update processing configuration |

#### 5.2.2 Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `processed_frame` | `{ "data": "base64", "latency": number }` | Processed video frame |
| `processed_audio` | `{ "data": "base64" }` | Converted audio |
| `error` | `{ "code": "string", "message": "string" }` | Error notification |
| `status` | `{ "processing": boolean, "fps": number }` | Processing status update |

---

## 6. Data Formats

### 6.1 Video Frame Format

```
Frame Data Structure:
┌─────────────────────────────────────────┐
│ Header (4 bytes)                        │
│ - Magic: 0x46415245 ("FARE")            │
│ - Width: 2 bytes (uint16)               │
│ - Height: 2 bytes (uint16)              │
│ - Format: 1 byte (0=JPEG,1=PNG,2=RAW)  │
│ - Timestamp: 8 bytes (uint64)           │
├─────────────────────────────────────────┤
│ Payload (Variable)                      │
│ - JPEG/PNG image data or                │
│ - RAW BGRA pixel data                    │
└─────────────────────────────────────────┘
```

### 6.2 Audio Chunk Format

```
Audio Data Structure:
┌─────────────────────────────────────────┐
│ Header (8 bytes)                        │
│ - Magic: 0x4145444F ("AEDO")            │
│ - Sample Rate: 4 bytes (uint32)         │
│ - Channels: 2 bytes (uint16)            │
│ - Samples: 2 bytes (uint16)             │
│ - Timestamp: 8 bytes (uint64)           │
├─────────────────────────────────────────┤
│ Payload (Variable)                      │
│ - PCM16 audio samples                   │
└─────────────────────────────────────────┘
```

---

## 7. Integration Points

### 7.1 Deep-Live-Cam Integration

The Java backend will communicate with Deep-Live-Cam via:

1. **Process Spawning**: Start Deep-Live-Cam as a subprocess
2. **IPC Mechanism**: 
   - stdin/stdout pipe for commands
   - Shared memory for frame data
   - Or REST API wrapper around Deep-Live-Cam

**Integration Approach:**
```
java
public class DeepLiveCamIntegration {
    
    public void startDeepLiveCam() {
        ProcessBuilder pb = new ProcessBuilder(
            "python", "run.py",
            "--source", "0",
            "--target-face", targetFacePath,
            "--output", "pipe:"
        );
        process = pb.start();
    }
    
    public byte[] processFrame(byte[] inputFrame) {
        // Write frame to process stdin
        // Read processed frame from stdout
    }
}
```

### 7.2 RVC Integration

**Integration Approach:**
```
java
public class RVCIntegration {
    
    public void startRVCServer() {
        // Start RVC WebUI in API mode
        ProcessBuilder pb = new ProcessBuilder(
            "python", "infer.py",
            "--api", "--port", "8000"
        );
    }
    
    public byte[] convertVoice(byte[] audioData) {
        // HTTP POST to RVC API
        // Return converted audio
    }
}
```

---

## 8. Performance Considerations

### 8.1 Latency Targets

| Component | Target Latency | Maximum Acceptable |
|-----------|---------------|-------------------|
| Network (WebRTC) | 50ms | 100ms |
| Frame Capture | 5ms | 10ms |
| Frame Transfer | 10ms | 20ms |
| AI Processing (Face) | 50ms | 100ms |
| AI Processing (Voice) | 30ms | 50ms |
| Frame Rendering | 5ms | 10ms |
| **Total End-to-End** | **150ms** | **300ms** |

### 8.2 Optimization Strategies

1. **Frame Resolution**: Use 480p (640x480) for processing
2. **Frame Rate**: Target 15-20 FPS for processed stream
3. **Batch Processing**: Process multiple frames in parallel
4. **GPU Acceleration**: Use CUDA-enabled PyTorch
5. **Edge Computing**: Deploy AI backend close to users
6. **Codec Selection**: Use H.264 for video encoding
7. **Audio Buffering**: Small buffers (10-20ms) for low latency

---

## 9. Security Considerations

### 9.1 Authentication

- JWT token-based authentication for WebSocket connections
- Room-based access control
- User session management

### 9.2 Privacy

- Process data locally when possible
- No persistent storage of video/audio without consent
- Clear user notification when AI processing is active
- Watermark processed content (optional)

### 9.3 Network Security

- HTTPS/WSS for all connections
- Certificate pinning (optional)
- Rate limiting on API endpoints

---

## 10. Deployment Architecture

### 10.1 Development Environment

```
┌─────────────────────────────────────────┐
│         Development Setup               │
├─────────────────────────────────────────┤
│  Browser (localhost:3000)               │
│         │                               │
│         ▼                               │
│  Java Backend (localhost:8080)          │
│         │                               │
│         ▼                               │
│  Deep-Live-Cam (localhost:XXX)          │
└─────────────────────────────────────────┘
```

### 10.2 Production Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Setup                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────────┐  │
│  │  Users   │─────▶│  Load Balancer│─────▶│  Java Backend    │  │
│  │ (Browsers)     │   (nginx)      │      │  (Auto-scaling)  │  │
│  └──────────┘      └──────────────┘      └────────┬─────────┘  │
│        │                                           │             │
│        │ WebRTC                                    │ GPU        │
│        ▼                                           ▼             │
│  ┌──────────┐                              ┌──────────────┐     │
│  │ TURN/STUN│                              │ GPU Servers  │     │
│  │ Server   │                              │ (AI Processing)    │
│  └──────────┘                              └──────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. Implementation Roadmap

### Phase 1: Basic WebRTC (Existing)
- [x] React frontend with WebRTC
- [x] Signaling server (Socket.io)
- [x] Room management

### Phase 2: Java Backend Setup
- [ ] Spring Boot project initialization
- [ ] WebSocket configuration
- [ ] REST API endpoints

### Phase 3: Face Swap Integration
- [ ] Deep-Live-Cam subprocess integration
- [ ] Frame capture and processing pipeline
- [ ] Processed frame delivery to frontend

### Phase 4: Voice Conversion Integration
- [ ] RVC server setup
- [ ] Audio chunk processing
- [ ] Voice conversion pipeline

### Phase 5: Optimization
- [ ] Latency optimization
- [ ] Performance monitoring
- [ ] Error handling improvements

---

## 12. File Structure Summary

### Files to Create (Java Backend)

```
webrtc-test/backend/
├── pom.xml
├── src/
│   └── main/
│       ├── java/com/aivideocall/
│       │   ├── AIVideoCallApplication.java
│       │   ├── config/
│       │   │   ├── WebSocketConfig.java
│       │   │   ├── CorsConfig.java
│       │   │   └── AppConfig.java
│       │   ├── controller/
│       │   │   ├── AIController.java
│       │   │   └── HealthController.java
│       │   ├── service/
│       │   │   ├── FaceSwapService.java
│       │   │   ├── VoiceConversionService.java
│       │   │   └── ProcessingService.java
│       │   ├── websocket/
│       │   │   ├── AIProcessingHandler.java
│       │   │   └── VideoStreamHandler.java
│       │   └── dto/
│       │       ├── ProcessRequest.java
│       │       └── ProcessResponse.java
│       └── resources/
│           └── application.yml
```

### Files to Modify (Frontend)

```
webrtc-test/client/
├── src/
│   ├── components/
│   │   ├── VideoCall.js       (Add AI integration)
│   │   └── ControlPanel.js    (New - AI controls)
│   ├── hooks/
│   │   ├── useAIProcessing.js (New)
│   │   └── useVoiceConversion.js (New)
│   └── services/
│       ├── aiService.js        (New)
│       └── mediaService.js    (New)
```

---

## 13. Next Steps

1. Create the Spring Boot project structure
2. Set up WebSocket endpoints for frame streaming
3. Integrate Deep-Live-Cam as a subprocess
4. Connect frontend to Java backend
5. Test the full pipeline

---

**Document Version:** 1.0  
**Created:** 2026-02-23  
**Author:** Technical Specification
