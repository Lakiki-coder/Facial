package com.aivideocall.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for AI processing operations.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessResponse {
    
    /**
     * Whether the processing was successful
     */
    private boolean success;
    
    /**
     * Processed frame data (Base64 encoded)
     */
    private String processedFrame;
    
    /**
     * Processed audio data (Base64 encoded)
     */
    private String processedAudio;
    
    /**
     * Processing latency in milliseconds
     */
    private Long latency;
    
    /**
     * Error message if processing failed
     */
    private String error;
    
    /**
     * Timestamp of the processed frame
     */
    private Long timestamp;
    
    /**
     * Processing status message
     */
    private String status;
    
    /**
     * Current FPS (frames per second)
     */
    private Double fps;
    
    /**
     * Session ID
     */
    private String sessionId;
}
