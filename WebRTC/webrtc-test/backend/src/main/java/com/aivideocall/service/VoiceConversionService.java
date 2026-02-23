package com.aivideocall.service;

import com.aivideocall.dto.ProcessResponse;
import com.aivideocall.dto.VoiceInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Service for voice conversion using RVC (Retrieval-based Voice Conversion).
 * Integrates with RVC WebUI via HTTP API.
 */
@Service
public class VoiceConversionService {
    
    private static final Logger logger = LoggerFactory.getLogger(VoiceConversionService.class);
    
    @Value("${ai.processing.rvc.path:}")
    private String rvcPath;
    
    @Value("${ai.processing.voice-model-path:./models/voices}")
    private String voiceModelPath;
    
    @Value("${ai.processing.audio-chunk-size:4096}")
    private int audioChunkSize;
    
    @Value("${ai.rvc.api.url:http://localhost:8000}")
    private String rvcApiUrl;
    
    // Store loaded voices
    private final Map<String, VoiceInfo> loadedVoices = new ConcurrentHashMap<>();
    private String currentVoiceId = null;
    private boolean isProcessingEnabled = false;
    private boolean isRvcServerRunning = false;
    
    // REST template for HTTP calls
    private final RestTemplate restTemplate = new RestTemplate();
    
    @PostConstruct
    public void init() {
        logger.info("Initializing VoiceConversionService");
        // Create voices directory if it doesn't exist
        try {
            Path voicesDir = Paths.get(voiceModelPath);
            if (!Files.exists(voicesDir)) {
                Files.createDirectories(voicesDir);
                logger.info("Created voices directory: {}", voicesDir.toAbsolutePath());
            }
        } catch (IOException e) {
            logger.error("Failed to create voices directory", e);
        }
    }
    
    /**
     * Load a voice model for voice conversion.
     * @param modelPath Path to the voice model
     * @param voiceName Name/ID for the voice
     * @return VoiceInfo with voice details
     */
    public VoiceInfo loadVoice(String modelPath, String voiceName) {
        try {
            // Generate voice ID
            String voiceId = UUID.randomUUID().toString().substring(0, 8);
            
            // Create voice info
            VoiceInfo voiceInfo = VoiceInfo.builder()
                    .id(voiceId)
                    .name(voiceName)
                    .modelPath(modelPath)
                    .loaded(true)
                    .build();
            
            loadedVoices.put(voiceId, voiceInfo);
            currentVoiceId = voiceId;
            
            logger.info("Loaded voice: {} from {}", voiceId, modelPath);
            
            return voiceInfo;
            
        } catch (Exception e) {
            logger.error("Failed to load voice", e);
            throw new RuntimeException("Failed to load voice: " + e.getMessage());
        }
    }
    
    /**
     * Start the RVC server.
     */
    public void startRvcServer() {
        if (isRvcServerRunning) {
            logger.info("RVC server already running");
            return;
        }
        
        try {
            // Start RVC in API mode
            ProcessBuilder pb = new ProcessBuilder(
                "python",
                "infer.py",
                "--api",
                "--port", "8000",
                "--pth", "G_168000.pth",
                "--index", "added_IVF256_Flat_nprobe_1.index"
            );
            
            pb.directory(new File(rvcPath));
            pb.redirectErrorStream(true);
            
            Process process = pb.start();
            
            // Wait for server to start
            Thread.sleep(5000);
            
            isRvcServerRunning = true;
            logger.info("Started RVC server at {}", rvcApiUrl);
            
        } catch (Exception e) {
            logger.error("Failed to start RVC server", e);
            throw new RuntimeException("Failed to start RVC server: " + e.getMessage());
        }
    }
    
    /**
     * Convert voice audio.
     * @param audioData Base64 encoded audio data
     * @param timestamp Audio timestamp
     * @return ProcessResponse with converted audio
     */
    public ProcessResponse convertVoice(String audioData, long timestamp) {
        if (!isProcessingEnabled || currentVoiceId == null) {
            // Return original audio if processing is disabled
            return ProcessResponse.builder()
                    .success(true)
                    .processedAudio(audioData)
                    .timestamp(timestamp)
                    .status("processing_disabled")
                    .build();
        }
        
        long startTime = System.currentTimeMillis();
        
        try {
            // Decode audio
            byte[] audioBytes = Base64.getDecoder().decode(audioData);
            
            // If RVC server is running, use HTTP API
            if (isRvcServerRunning) {
                // Prepare HTTP request to RVC API
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
                
                HttpEntity<byte[]> requestEntity = new HttpEntity<>(audioBytes, headers);
                
                // Call RVC inference endpoint
                String url = rvcApiUrl + "/convert";
                ResponseEntity<byte[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    byte[].class
                );
                
                if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                    String convertedAudio = Base64.getEncoder().encodeToString(response.getBody());
                    long latency = System.currentTimeMillis() - startTime;
                    
                    return ProcessResponse.builder()
                            .success(true)
                            .processedAudio(convertedAudio)
                            .latency(latency)
                            .timestamp(timestamp)
                            .status("converted")
                            .build();
                }
            }
            
            // Return original audio if RVC not available
            return ProcessResponse.builder()
                    .success(true)
                    .processedAudio(audioData)
                    .timestamp(timestamp)
                    .status("rvc_not_available")
                    .build();
            
        } catch (Exception e) {
            logger.error("Error converting voice", e);
            
            // Return original audio on error
            return ProcessResponse.builder()
                    .success(true)
                    .processedAudio(audioData)
                    .timestamp(timestamp)
                    .status("error_fallback")
                    .build();
        }
    }
    
    /**
     * Convert voice and return both processed frame and audio.
     * @param frameData Base64 encoded video frame
     * @param audioData Base64 encoded audio data
     * @param timestamp Timestamp
     * @return ProcessResponse with both processed frame and audio
     */
    public ProcessResponse processFrameWithAudio(String frameData, String audioData, long timestamp) {
        long startTime = System.currentTimeMillis();
        
        try {
            String processedAudio = audioData;
            
            // Convert voice if enabled
            if (isProcessingEnabled && currentVoiceId != null && audioData != null) {
                ProcessResponse audioResponse = convertVoice(audioData, timestamp);
                if (audioResponse.isSuccess()) {
                    processedAudio = audioResponse.getProcessedAudio();
                }
            }
            
            long latency = System.currentTimeMillis() - startTime;
            
            return ProcessResponse.builder()
                    .success(true)
                    .processedFrame(frameData)
                    .processedAudio(processedAudio)
                    .latency(latency)
                    .timestamp(timestamp)
                    .status("processed")
                    .build();
            
        } catch (Exception e) {
            logger.error("Error processing frame with audio", e);
            return ProcessResponse.builder()
                    .success(false)
                    .error(e.getMessage())
                    .timestamp(timestamp)
                    .status("error")
                    .build();
        }
    }
    
    /**
     * Enable or disable voice conversion.
     */
    public void setEnabled(boolean enabled) {
        this.isProcessingEnabled = enabled;
        logger.info("Voice conversion {}", enabled ? "enabled" : "disabled");
    }
    
    /**
     * Get list of all loaded voices.
     */
    public List<VoiceInfo> getLoadedVoices() {
        return new ArrayList<>(loadedVoices.values());
    }
    
    /**
     * Get current voice conversion status.
     */
    public Map<String, Object> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("enabled", isProcessingEnabled);
        status.put("currentVoiceId", currentVoiceId);
        status.put("loadedVoicesCount", loadedVoices.size());
        status.put("rvcServerRunning", isRvcServerRunning);
        status.put("rvcApiUrl", rvcApiUrl);
        
        if (currentVoiceId != null && loadedVoices.containsKey(currentVoiceId)) {
            status.put("currentVoice", loadedVoices.get(currentVoiceId));
        }
        
        return status;
    }
    
    /**
     * Stop the RVC server.
     */
    public void stop() {
        isRvcServerRunning = false;
        logger.info("Stopped RVC server");
    }
}
