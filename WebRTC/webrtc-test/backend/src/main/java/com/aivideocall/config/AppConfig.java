package com.aivideocall.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Application configuration properties.
 */
@Configuration
public class AppConfig {
    
    // AI Processing Configuration
    @Value("${ai.processing.deep-live-cam.path:}")
    private String deepLiveCamPath;
    
    @Value("${ai.processing.rvc.path:}")
    private String rvcPath;
    
    @Value("${ai.processing.target-face-path:}")
    private String targetFacePath;
    
    @Value("${ai.processing.voice-model-path:}")
    private String voiceModelPath;
    
    @Value("${ai.processing.frame-width:640}")
    private int frameWidth;
    
    @Value("${ai.processing.frame-height:480}")
    private int frameHeight;
    
    @Value("${ai.processing.target-fps:20}")
    private int targetFps;
    
    // Server Configuration
    @Value("${server.port:8080}")
    private int serverPort;
    
    @Value("${server.ws.port:8081}")
    private int wsPort;
    
    // GPU Configuration
    @Value("${ai.gpu.enabled:true}")
    private boolean gpuEnabled;
    
    @Value("${ai.gpu.device-id:0}")
    private int gpuDeviceId;
    
    // Processing Configuration
    @Value("${ai.processing.max-concurrent-sessions:10}")
    private int maxConcurrentSessions;
    
    @Value("${ai.processing.frame-queue-size:5}")
    private int frameQueueSize;
    
    @Value("${ai.processing.audio-chunk-size:1024}")
    private int audioChunkSize;
    
    // Getters
    public String getDeepLiveCamPath() { return deepLiveCamPath; }
    public String getRvcPath() { return rvcPath; }
    public String getTargetFacePath() { return targetFacePath; }
    public String getVoiceModelPath() { return voiceModelPath; }
    public int getFrameWidth() { return frameWidth; }
    public int getFrameHeight() { return frameHeight; }
    public int getTargetFps() { return targetFps; }
    public int getServerPort() { return serverPort; }
    public int getWsPort() { return wsPort; }
    public boolean isGpuEnabled() { return gpuEnabled; }
    public int getGpuDeviceId() { return gpuDeviceId; }
    public int getMaxConcurrentSessions() { return maxConcurrentSessions; }
    public int getFrameQueueSize() { return frameQueueSize; }
    public int getAudioChunkSize() { return audioChunkSize; }
}
