package com.aivideocall.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for face information.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaceInfo {
    
    /**
     * Unique identifier for the face
     */
    private String id;
    
    /**
     * Display name for the face
     */
    private String name;
    
    /**
     * Path to the face image
     */
    private String imagePath;
    
    /**
     * Thumbnail data (Base64)
     */
    private String thumbnail;
    
    /**
     * Whether the face is currently loaded
     */
    private boolean loaded;
}
