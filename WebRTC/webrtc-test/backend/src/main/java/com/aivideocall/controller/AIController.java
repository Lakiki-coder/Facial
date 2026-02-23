package com.aivideocall.controller;

import com.aivideocall.dto.FaceInfo;
import com.aivideocall.dto.ProcessResponse;
import com.aivideocall.dto.ProcessRequest;
import com.aivideocall.dto.VoiceInfo;
import com.aivideocall.service.FaceSwapService;
import com.aivideocall.service.VoiceConversionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller for AI processing operations.
 */
@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AIController {
    
    private static final Logger logger = LoggerFactory.getLogger(AIController.class);
    
    @Autowired
    private FaceSwapService faceSwapService;
    
    @Autowired
    private VoiceConversionService voiceConversionService;
    
    /**
     * Health check endpoint for AI services.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "ok");
        health.put("faceSwap", faceSwapService.getStatus());
        health.put("voiceConversion", voiceConversionService.getStatus());
        return ResponseEntity.ok(health);
    }
    
    /**
     * Get face swap service status.
     */
    @GetMapping("/face-swap/status")
    public ResponseEntity<Map<String, Object>> getFaceSwapStatus() {
        return ResponseEntity.ok(faceSwapService.getStatus());
    }
    
    /**
     * Load a face for face swapping.
     */
    @PostMapping("/face-swap/load")
    public ResponseEntity<FaceInfo> loadFace(@RequestBody Map<String, String> request) {
        String imageData = request.get("imageData");
        String faceName = request.get("faceName");
        
        if (imageData == null || faceName == null) {
            return ResponseEntity.badRequest().build();
        }
        
        try {
            FaceInfo faceInfo = faceSwapService.loadFace(imageData, faceName);
            return ResponseEntity.ok(faceInfo);
        } catch (Exception e) {
            logger.error("Failed to load face", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Enable or disable face swapping.
     */
    @PostMapping("/face-swap/enable")
    public ResponseEntity<Map<String, Object>> enableFaceSwap(@RequestBody Map<String, Boolean> request) {
        Boolean enabled = request.get("enabled");
        if (enabled == null) {
            return ResponseEntity.badRequest().build();
        }
        
        faceSwapService.setEnabled(enabled);
        
        Map<String, Object> response = new HashMap<>();
        response.put("enabled", enabled);
        response.put("status", faceSwapService.getStatus());
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get list of loaded faces.
     */
    @GetMapping("/face-swap/faces")
    public ResponseEntity<List<FaceInfo>> getLoadedFaces() {
        return ResponseEntity.ok(faceSwapService.getLoadedFaces());
    }
    
    /**
     * Get voice conversion service status.
     */
    @GetMapping("/voice-convert/status")
    public ResponseEntity<Map<String, Object>> getVoiceConvertStatus() {
        return ResponseEntity.ok(voiceConversionService.getStatus());
    }
    
    /**
     * Load a voice model for voice conversion.
     */
    @PostMapping("/voice-convert/load")
    public ResponseEntity<VoiceInfo> loadVoice(@RequestBody Map<String, String> request) {
        String modelPath = request.get("modelPath");
        String voiceName = request.get("voiceName");
        
        if (modelPath == null || voiceName == null) {
            return ResponseEntity.badRequest().build();
        }
        
        try {
            VoiceInfo voiceInfo = voiceConversionService.loadVoice(modelPath, voiceName);
            return ResponseEntity.ok(voiceInfo);
        } catch (Exception e) {
            logger.error("Failed to load voice", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Enable or disable voice conversion.
     */
    @PostMapping("/voice-convert/enable")
    public ResponseEntity<Map<String, Object>> enableVoiceConvert(@RequestBody Map<String, Boolean> request) {
        Boolean enabled = request.get("enabled");
        if (enabled == null) {
            return ResponseEntity.badRequest().build();
        }
        
        voiceConversionService.setEnabled(enabled);
        
        Map<String, Object> response = new HashMap<>();
        response.put("enabled", enabled);
        response.put("status", voiceConversionService.getStatus());
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get list of loaded voices.
     */
    @GetMapping("/voice-convert/voices")
    public ResponseEntity<List<VoiceInfo>> getLoadedVoices() {
        return ResponseEntity.ok(voiceConversionService.getLoadedVoices());
    }
    
    /**
     * Process a single frame (HTTP endpoint alternative to WebSocket).
     */
    @PostMapping("/process/frame")
    public ResponseEntity<ProcessResponse> processFrame(@RequestBody ProcessRequest request) {
        try {
            ProcessResponse response = faceSwapService.processFrame(
                request.getFrameData(),
                request.getTimestamp() != null ? request.getTimestamp() : System.currentTimeMillis()
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to process frame", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Process audio (HTTP endpoint alternative to WebSocket).
     */
    @PostMapping("/process/audio")
    public ResponseEntity<ProcessResponse> processAudio(@RequestBody ProcessRequest request) {
        try {
            ProcessResponse response = voiceConversionService.convertVoice(
                request.getAudioData(),
                request.getTimestamp() != null ? request.getTimestamp() : System.currentTimeMillis()
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to process audio", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Process both frame and audio.
     */
    @PostMapping("/process")
    public ResponseEntity<ProcessResponse> process(@RequestBody ProcessRequest request) {
        try {
            ProcessResponse response = voiceConversionService.processFrameWithAudio(
                request.getFrameData(),
                request.getAudioData(),
                request.getTimestamp() != null ? request.getTimestamp() : System.currentTimeMillis()
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to process", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
