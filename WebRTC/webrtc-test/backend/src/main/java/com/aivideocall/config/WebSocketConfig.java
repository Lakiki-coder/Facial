package com.aivideocall.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.aivideocall.websocket.AIProcessingHandler;
import com.aivideocall.websocket.VideoStreamHandler;

/**
 * WebSocket configuration for real-time AI processing.
 * 
 * Endpoints:
 * - /ws/ai-process: For sending frames and receiving processed results
 * - /ws/video-stream: For video streaming
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    
    @Autowired
    private AIProcessingHandler aiProcessingHandler;
    
    @Autowired
    private VideoStreamHandler videoStreamHandler;
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // AI Processing WebSocket - receives frames and returns processed results
        registry.addHandler(aiProcessingHandler, "/ws/ai-process")
                .setAllowedOrigins("*")
                .addInterceptors(new WebSocketHandshakeInterceptor());
        
        // Video Stream WebSocket - for video data streaming
        registry.addHandler(videoStreamHandler, "/ws/video-stream")
                .setAllowedOrigins("*")
                .addInterceptors(new WebSocketHandshakeInterceptor());
        
        // Alternative endpoint without custom interceptor
        registry.addHandler(aiProcessingHandler, "/ws/ai-process/**")
                .setAllowedOrigins("*");
        
        registry.addHandler(videoStreamHandler, "/ws/video-stream/**")
                .setAllowedOrigins("*");
    }
}
