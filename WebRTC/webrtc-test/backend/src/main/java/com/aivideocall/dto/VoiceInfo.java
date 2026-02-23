package com.aivideocall.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for voice information.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceInfo {
    
    /**
     * Unique identifier for the voice
     */
    private String id;
    
    /**
     * Display name for the voice
     */
    private String name;
    
    /**
     * Path to the voice model
     */
    private String modelPath;
    
    /**
     * Whether the voice model is currently loaded
     */
    private boolean loaded;
}
