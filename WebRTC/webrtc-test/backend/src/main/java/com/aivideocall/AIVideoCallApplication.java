package com.aivideocall;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Main application class for AI Video Call Backend.
 * 
 * This application provides:
 * - WebSocket endpoints for real-time video/audio processing
 * - REST API for configuration and health monitoring
 * - Integration with Deep-Live-Cam for face swapping
 * - Integration with RVC for voice conversion
 */
@SpringBootApplication
@EnableAsync
public class AIVideoCallApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(AIVideoCallApplication.class, args);
    }
}
