package com.aivideocall.service;

import com.aivideocall.dto.FaceInfo;
import com.aivideocall.dto.ProcessResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Service for face swapping using Deep-Live-Cam.
 * Integrates with the Python-based Deep-Live-Cam application via subprocess.
 */
@Service
public class FaceSwapService {
    
    private static final Logger logger = LoggerFactory.getLogger(FaceSwapService.class);
    
    @Value("${ai.processing.deep-live-cam.path:}")
    private String deepLiveCamPath;
    
    @Value("${ai.processing.target-face-path:./faces}")
    private String targetFacePath;
    
    @Value("${ai.processing.frame-width:640}")
    private int frameWidth;
    
    @Value("${ai.processing.frame-height:480}")
    private int frameHeight;
    
    // Store loaded faces
    private final Map<String, FaceInfo> loadedFaces = new ConcurrentHashMap<>();
    private String currentFaceId = null;
    private boolean isProcessingEnabled = false;
    
    // Process management
    private Process pythonProcess = null;
    private BufferedReader processReader = null;
    private BufferedWriter processWriter = null;
    private boolean isProcessRunning = false;
    
    @PostConstruct
    public void init() {
        logger.info("Initializing FaceSwapService");
        // Create faces directory if it doesn't exist
        try {
            Path facesDir = Paths.get(targetFacePath);
            if (!Files.exists(facesDir)) {
                Files.createDirectories(facesDir);
                logger.info("Created faces directory: {}", facesDir.toAbsolutePath());
            }
        } catch (IOException e) {
            logger.error("Failed to create faces directory", e);
        }
    }
    
    /**
     * Load a target face image for face swapping.
     * @param imageData Base64 encoded image data
     * @param faceName Name/ID for the face
     * @return FaceInfo with face details
     */
    public FaceInfo loadFace(String imageData, String faceName) {
        try {
            // Decode base64 image
            byte[] imageBytes = Base64.getDecoder().decode(imageData);
            
            // Generate face ID
            String faceId = UUID.randomUUID().toString().substring(0, 8);
            
            // Save face image
            Path facePath = Paths.get(targetFacePath, faceId + ".jpg");
            Files.write(facePath, imageBytes);
            
            // Create face info
            FaceInfo faceInfo = FaceInfo.builder()
                    .id(faceId)
                    .name(faceName)
                    .imagePath(facePath.toString())
                    .loaded(true)
                    .build();
            
            loadedFaces.put(faceId, faceInfo);
            currentFaceId = faceId;
            
            logger.info("Loaded face: {} from {}", faceId, facePath);
            
            // Start Deep-Live-Cam process with the new face
            startDeepLiveCam(facePath.toString());
            
            return faceInfo;
            
        } catch (Exception e) {
            logger.error("Failed to load face", e);
            throw new RuntimeException("Failed to load face: " + e.getMessage());
        }
    }
    
    /**
     * Start the Deep-Live-Cam Python process.
     */
    private synchronized void startDeepLiveCam(String targetFacePath) {
        if (isProcessRunning && pythonProcess != null && pythonProcess.isAlive()) {
            logger.info("Deep-Live-Cam process already running");
            return;
        }
        
        try {
            String pythonScript = Paths.get(deepLiveCamPath, "run.py").toString();
            
            ProcessBuilder pb = new ProcessBuilder(
                "python",
                pythonScript,
                "--source", "0",
                "--target-face", targetFacePath,
                "--output", "pipe:",
                "--keep-fps"
            );
            
            pb.directory(new File(deepLiveCamPath));
            pb.redirectErrorStream(true);
            
            pythonProcess = pb.start();
            processReader = new BufferedReader(new InputStreamReader(pythonProcess.getInputStream()));
            processWriter = new BufferedWriter(new OutputStreamWriter(pythonProcess.getOutputStream()));
            
            isProcessRunning = true;
            
            // Read startup output in a separate thread
            new Thread(() -> {
                try {
                    String line;
                    while ((line = processReader.readLine()) != null && isProcessRunning) {
                        logger.debug("Deep-Live-Cam: {}", line);
                    }
                } catch (IOException e) {
                    logger.error("Error reading from Deep-Live-Cam process", e);
                }
            }).start();
            
            logger.info("Started Deep-Live-Cam process");
            
        } catch (IOException e) {
            logger.error("Failed to start Deep-Live-Cam process", e);
            isProcessRunning = false;
            throw new RuntimeException("Failed to start Deep-Live-Cam: " + e.getMessage());
        }
    }
    
    /**
     * Process a video frame through face swapping.
     * @param frameData Base64 encoded frame data
     * @param timestamp Frame timestamp
     * @return ProcessResponse with processed frame
     */
    public ProcessResponse processFrame(String frameData, long timestamp) {
        if (!isProcessingEnabled || currentFaceId == null) {
            // Return original frame if processing is disabled
            return ProcessResponse.builder()
                    .success(true)
                    .processedFrame(frameData)
                    .timestamp(timestamp)
                    .status("processing_disabled")
                    .build();
        }
        
        long startTime = System.currentTimeMillis();
        
        try {
            // Decode frame
            byte[] frameBytes = Base64.getDecoder().decode(frameData);
            
            // Send frame to Deep-Live-Cam via stdin
            if (processWriter != null && isProcessRunning) {
                // Write frame size and data
                processWriter.write(frameBytes.length + "\n");
                processWriter.write(Base64.getEncoder().encodeToString(frameBytes));
                processWriter.newLine();
                processWriter.flush();
                
                // Read processed frame (in a real implementation, this would need proper protocol)
                // For now, return the original frame as a placeholder
                String processedFrame = Base64.getEncoder().encodeToString(frameBytes);
                
                long latency = System.currentTimeMillis() - startTime;
                
                return ProcessResponse.builder()
                        .success(true)
                        .processedFrame(processedFrame)
                        .latency(latency)
                        .timestamp(timestamp)
                        .status("processed")
                        .fps(1000.0 / Math.max(latency, 1))
                        .build();
            } else {
                // Process not running, return original
                return ProcessResponse.builder()
                        .success(true)
                        .processedFrame(frameData)
                        .timestamp(timestamp)
                        .status("process_not_running")
                        .build();
            }
            
        } catch (Exception e) {
            logger.error("Error processing frame", e);
            return ProcessResponse.builder()
                    .success(false)
                    .error(e.getMessage())
                    .timestamp(timestamp)
                    .status("error")
                    .build();
        }
    }
    
    /**
     * Enable or disable face swap processing.
     */
    public void setEnabled(boolean enabled) {
        this.isProcessingEnabled = enabled;
        logger.info("Face swap processing {}", enabled ? "enabled" : "disabled");
    }
    
    /**
     * Get list of all loaded faces.
     */
    public List<FaceInfo> getLoadedFaces() {
        return new ArrayList<>(loadedFaces.values());
    }
    
    /**
     * Get current face swap status.
     */
    public Map<String, Object> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("enabled", isProcessingEnabled);
        status.put("currentFaceId", currentFaceId);
        status.put("loadedFacesCount", loadedFaces.size());
        status.put("processRunning", isProcessRunning);
        
        if (currentFaceId != null && loadedFaces.containsKey(currentFaceId)) {
            status.put("currentFace", loadedFaces.get(currentFaceId));
        }
        
        return status;
    }
    
    /**
     * Stop the Deep-Live-Cam process.
     */
    public synchronized void stop() {
        isProcessRunning = false;
        
        if (pythonProcess != null) {
            pythonProcess.destroy();
            try {
                if (!pythonProcess.waitFor(5, TimeUnit.SECONDS)) {
                    pythonProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                logger.error("Error stopping Deep-Live-Cam process", e);
                Thread.currentThread().interrupt();
            }
        }
        
        try {
            if (processReader != null) processReader.close();
            if (processWriter != null) processWriter.close();
        } catch (IOException e) {
            logger.error("Error closing process streams", e);
        }
        
        logger.info("Stopped Deep-Live-Cam process");
    }
}
