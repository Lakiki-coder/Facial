package com.aivideocall.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.HashMap;
import java.util.Map;

/**
 * WebSocket handshake interceptor for logging and custom headers.
 */
@Component
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {
    
    private static final Logger logger = LoggerFactory.getLogger(WebSocketHandshakeInterceptor.class);
    
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        
        String sessionId = request.getURI().getPath();
        logger.info("WebSocket handshake initiated: {}", sessionId);
        
        // Add session attributes
        attributes.put("sessionId", sessionId);
        attributes.put("timestamp", System.currentTimeMillis());
        
        return true;
    }
    
    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        
        if (exception != null) {
            logger.error("WebSocket handshake failed: {}", exception.getMessage());
        } else {
            logger.info("WebSocket handshake completed successfully for: {}", request.getURI().getPath());
        }
    }
}
