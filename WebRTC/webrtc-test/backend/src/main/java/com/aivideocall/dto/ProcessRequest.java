package com.aivideocall.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for AI processing operations.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessRequest {
    
    /**
     * Type of processing: "face_swap", "voice_convert", "both"
     */
    private String processingType;
    
    /**
     * Target face ID for face swapping
     */
    private String faceId;
    
    /**
     * Target voice ID for voice conversion
     */
    private String voiceId;
    
    /**
     * Base64 encoded frame data
     */
    private String frameData;
    
    /**
     * Base64 encoded audio data
     */
    private String audioData;
    
    /**
     * Timestamp of the frame/audio
     */
    private Long timestamp;
    
    /**
     * Session ID for tracking
     */
    private String sessionId;
    
    /**
     * Whether to enable processing
     */
    private Boolean enabled;
}
