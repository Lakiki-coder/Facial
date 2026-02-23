package com.aivideocall.websocket;

import com.aivideocall.dto.ProcessResponse;
import com.aivideocall.service.FaceSwapService;
import com.aivideocall.service.VoiceConversionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for AI processing.
 * Receives video frames and audio data, processes them, and returns results.
 */
@Component
public class AIProcessingHandler extends TextWebSocketHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(AIProcessingHandler.class);
    
    @Autowired
    private FaceSwapService faceSwapService;
    
    @Autowired
    private VoiceConversionService voiceConversionService;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        logger.info("AI Processing WebSocket connected: {}", sessionId);
        
        // Send welcome message
        Map<String, Object> welcome = Map.of(
            "type", "connected",
            "sessionId", sessionId,
            "message", "Connected to AI Processing Server"
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(welcome)));
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        
        try {
            JsonNode jsonNode = objectMapper.readTree(payload);
            String messageType = jsonNode.has("type") ? jsonNode.get("type").asText() : "unknown";
            
            switch (messageType) {
                case "frame":
                    handleFrameMessage(session, jsonNode);
                    break;
                    
                case "audio":
                    handleAudioMessage(session, jsonNode);
                    break;
                    
                case "config":
                    handleConfigMessage(session, jsonNode);
                    break;
                    
                case "ping":
                    handlePingMessage(session);
                    break;
                    
                default:
                    logger.warn("Unknown message type: {}", messageType);
                    sendError(session, "Unknown message type: " + messageType);
            }
            
        } catch (Exception e) {
            logger.error("Error handling message", e);
            sendError(session, "Error processing message: " + e.getMessage());
        }
    }
    
    /**
     * Handle video frame processing message.
     */
    private void handleFrameMessage(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String frameData = jsonNode.has("data") ? jsonNode.get("data").asText() : null;
        long timestamp = jsonNode.has("timestamp") ? jsonNode.get("timestamp").asLong() : System.currentTimeMillis();
        
        if (frameData == null) {
            sendError(session, "Missing frame data");
            return;
        }
        
        // Process frame through face swap service
        ProcessResponse response = faceSwapService.processFrame(frameData, timestamp);
        
        // Send response
        Map<String, Object> result = Map.of(
            "type", "processed_frame",
            "data", response.getProcessedFrame() != null ? response.getProcessedFrame() : frameData,
            "timestamp", response.getTimestamp(),
            "latency", response.getLatency() != null ? response.getLatency() : 0,
            "fps", response.getFps() != null ? response.getFps() : 0,
            "status", response.getStatus()
        );
        
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(result)));
    }
    
    /**
     * Handle audio processing message.
     */
    private void handleAudioMessage(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String audioData = jsonNode.has("data") ? jsonNode.get("data").asText() : null;
        long timestamp = jsonNode.has("timestamp") ? jsonNode.get("timestamp").asLong() : System.currentTimeMillis();
        
        if (audioData == null) {
            sendError(session, "Missing audio data");
            return;
        }
        
        // Process audio through voice conversion service
        ProcessResponse response = voiceConversionService.convertVoice(audioData, timestamp);
        
        // Send response
        Map<String, Object> result = Map.of(
            "type", "processed_audio",
            "data", response.getProcessedAudio() != null ? response.getProcessedAudio() : audioData,
            "timestamp", response.getTimestamp(),
            "latency", response.getLatency() != null ? response.getLatency() : 0,
            "status", response.getStatus()
        );
        
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(result)));
    }
    
    /**
     * Handle configuration message.
     */
    private void handleConfigMessage(WebSocketSession session, JsonNode jsonNode) throws IOException {
        boolean faceSwapEnabled = jsonNode.has("faceSwap") && jsonNode.get("faceSwap").asBoolean();
        boolean voiceConvertEnabled = jsonNode.has("voiceConvert") && jsonNode.get("voiceConvert").asBoolean();
        
        // Update services
        faceSwapService.setEnabled(faceSwapEnabled);
        voiceConversionService.setEnabled(voiceConvertEnabled);
        
        // Get current status
        Map<String, Object> status = Map.of(
            "type", "config_status",
            "faceSwapEnabled", faceSwapEnabled,
            "voiceConvertEnabled", voiceConvertEnabled,
            "faceSwapStatus", faceSwapService.getStatus(),
            "voiceConvertStatus", voiceConversionService.getStatus()
        );
        
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(status)));
    }
    
    /**
     * Handle ping message.
     */
    private void handlePingMessage(WebSocketSession session) throws IOException {
        Map<String, Object> pong = Map.of(
            "type", "pong",
            "timestamp", System.currentTimeMillis()
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(pong)));
    }
    
    /**
     * Send error message to client.
     */
    private void sendError(WebSocketSession session, String error) throws IOException {
        Map<String, Object> errorMsg = Map.of(
            "type", "error",
            "message", error
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorMsg)));
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        sessions.remove(sessionId);
        logger.info("AI Processing WebSocket disconnected: {} with status: {}", sessionId, status);
    }
    
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("WebSocket transport error for session: {}", session.getId(), exception);
        sessions.remove(session.getId());
    }
    
    /**
     * Get number of active sessions.
     */
    public int getActiveSessionCount() {
        return sessions.size();
    }
}
