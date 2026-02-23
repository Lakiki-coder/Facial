package com.aivideocall.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for video streaming.
 * Handles direct video streaming between clients.
 */
@Component
public class VideoStreamHandler extends TextWebSocketHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(VideoStreamHandler.class);
    
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        
        // Get room ID from session attributes (set by interceptor)
        String roomId = (String) session.getAttributes().get("roomId");
        
        logger.info("Video Stream WebSocket connected: {} for room: {}", sessionId, roomId);
        
        // Send welcome message
        String welcome = String.format(
            "{\"type\":\"connected\",\"sessionId\":\"%s\",\"roomId\":\"%s\"}",
            sessionId, roomId != null ? roomId : "unknown"
        );
        session.sendMessage(new TextMessage(welcome));
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        String sessionId = session.getId();
        
        // Get room ID from session attributes
        String roomId = (String) session.getAttributes().get("roomId");
        
        logger.debug("Received message from {}: {}", sessionId, payload.substring(0, Math.min(50, payload.length())));
        
        // Broadcast to other sessions in the same room
        for (Map.Entry<String, WebSocketSession> entry : sessions.entrySet()) {
            String targetId = entry.getKey();
            WebSocketSession targetSession = entry.getValue();
            
            // Skip self
            if (targetId.equals(sessionId)) {
                continue;
            }
            
            // Check if same room
            String targetRoomId = (String) targetSession.getAttributes().get("roomId");
            if (roomId != null && roomId.equals(targetRoomId)) {
                try {
                    // Forward the message to the other peer
                    targetSession.sendMessage(message);
                } catch (IOException e) {
                    logger.error("Error forwarding message to {}", targetId, e);
                }
            }
        }
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        String roomId = (String) session.getAttributes().get("roomId");
        
        sessions.remove(sessionId);
        logger.info("Video Stream WebSocket disconnected: {} from room: {} with status: {}", 
                    sessionId, roomId, status);
        
        // Notify other peers in the room
        if (roomId != null) {
            String disconnectMsg = String.format(
                "{\"type\":\"peer_disconnected\",\"sessionId\":\"%s\",\"roomId\":\"%s\"}",
                sessionId, roomId
            );
            
            for (WebSocketSession s : sessions.values()) {
                String targetRoomId = (String) s.getAttributes().get("roomId");
                if (roomId.equals(targetRoomId)) {
                    try {
                        s.sendMessage(new TextMessage(disconnectMsg));
                    } catch (IOException e) {
                        logger.error("Error sending disconnect notification", e);
                    }
                }
            }
        }
    }
    
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("Video Stream WebSocket transport error for session: {}", session.getId(), exception);
        sessions.remove(session.getId());
    }
    
    /**
     * Get number of active video streaming sessions.
     */
    public int getActiveSessionCount() {
        return sessions.size();
    }
    
    /**
     * Get sessions count per room.
     */
    public Map<String, Integer> getSessionCountPerRoom() {
        Map<String, Integer> roomCounts = new ConcurrentHashMap<>();
        
        for (WebSocketSession session : sessions.values()) {
            String roomId = (String) session.getAttributes().get("roomId");
            if (roomId != null) {
                roomCounts.merge(roomId, 1, Integer::sum);
            }
        }
        
        return roomCounts;
    }
}
