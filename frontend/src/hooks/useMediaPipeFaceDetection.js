import { useState, useEffect, useRef, useCallback } from 'react';
// import { FaceMesh } from '@mediapipe/face_mesh'; // <-- REMOVE THIS IMPORT

// --- Configuration ---
const DETECTION_INTERVAL_MS = 500; // How often to run detection
const YAW_THRESHOLD = 0.3; // Sensitivity for looking away (0.3-0.5 is a reasonable range to start tuning)
const PITCH_THRESHOLD = 0.05; // INCREASED AGAIN: Sensitivity for looking up/down (Adjust based on logs)
// Lower value = more sensitive (triggers on smaller head turns)
// Higher value = less sensitive (requires larger head turns)

export const useMediaPipeFaceDetection = (videoRef, isCameraActive, isVideoReady) => {
    const [detectorReady, setDetectorReady] = useState(false);
    const [detectionStatus, setDetectionStatus] = useState('Initializing detector...');
    const [isLookingAway, setIsLookingAway] = useState(false); // <-- NEW: State for head pose
    const [faceDetectedBox, setFaceDetectedBox] = useState(null);
    const [numberOfFaces, setNumberOfFaces] = useState(0);
    const detectorRef = useRef(null);
    const detectionIntervalRef = useRef(null);
    const resultsListenerAdded = useRef(false);
    const videoDimensionsRef = useRef({ width: 0, height: 0 }); // To store video dimensions

    // --- Initialize MediaPipe FaceMesh ---
    useEffect(() => {
        const initialize = async () => {
            setDetectionStatus('Checking for MediaPipe FaceMesh...');
            // const mpFaceDetection = window.FaceDetection; // No longer needed
            // const tf = window.tf; // No longer needed for FaceMesh directly

            /* // TFJS backend setup is not directly required by FaceMesh like it was for FaceDetection
                 console.error("MediaPipe FaceDetection or TensorFlow.js not found on window object.");
                 setDetectionStatus('Error: Required libraries not loaded.');
                 setDetectorReady(false);
                 return;
            }

            setDetectionStatus('Setting up TFJS backend...');
            try {
                await tf.setBackend('webgl');
                await tf.ready();
                console.log('useMediaPipeFaceDetection: TFJS WebGL backend ready.');
            */

            try {
                setDetectionStatus('Loading MediaPipe Face Mesh model...');

                // --- Access FaceMesh from window object ---
                const FaceMesh = window.FaceMesh;
                if (!FaceMesh) {
                    throw new Error("FaceMesh not found on window object. Ensure MediaPipe scripts are loaded.");
                }
                // --- End Access ---

                // Use FaceMesh constructor directly
                const faceMeshInstance = new FaceMesh({locateFile: (file) => {
                    // Ensure you have @mediapipe/face_mesh installed or use CDN
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }});

                const handleResults = (results) => {
                    const videoElement = videoRef.current;
                    // FaceMesh returns multiFaceLandmarks array
                    const detectedFacesCount = results.multiFaceLandmarks ? results.multiFaceLandmarks.length : 0;
                    // console.log(`[handleResults] detectedFacesCount: ${detectedFacesCount}`);

                    // Update face count state FIRST
                    setNumberOfFaces(detectedFacesCount);

                    let lookingAway = false; // Default to not looking away
                    let poseReason = ''; // To store why lookingAway is true (yaw or pitch)
                    let calculatedBox = null; // To store the calculated bounding box

                    // Then update status and box based on the count
                    if (detectedFacesCount === 0) {
                        setDetectionStatus('No face detected. Please position your face.');
                    } else if (detectedFacesCount === 1) {
                        setDetectionStatus('Face detected. Ready to capture.');
                        const landmarks = results.multiFaceLandmarks[0]; // Get landmarks for the first face

                        if (videoElement && videoDimensionsRef.current.width > 0 && landmarks) {
                            // console.log("[handleResults] Video element ready & landmarks found.");

                            // --- Head Pose Estimation (Yaw) ---
                            // Use FaceMesh landmark indices:
                            // Nose Tip: 1
                            // Left Eye (inner corner): 133
                            // Right Eye (inner corner): 362
                            // Forehead Top: 10
                            // Chin Bottom: 152
                            // Between Eyes (approx): 6
                            // (Check MediaPipe docs for exact landmark map if needed)
                            if (landmarks.length > 362) { // Ensure highest index needed exists
                                const noseTip = landmarks[1];
                                const leftEyeInner = landmarks[133];
                                const rightEyeInner = landmarks[362];
                                const foreheadTop = landmarks[10];
                                const chinBottom = landmarks[152];
                                const betweenEyes = landmarks[6]; // Approx center between eyes

                                // Calculate horizontal distance between eyes (reference width)
                                // Use inner corners for better stability
                                const eyeWidth = Math.abs(rightEyeInner.x - leftEyeInner.x);
                                // console.log(`[Pose] eyeWidth: ${eyeWidth.toFixed(4)}`); // DEBUG

                                if (eyeWidth > 0) { // Avoid division by zero
                                    // Calculate horizontal midpoint between eyes
                                    const eyeMidX = (rightEyeInner.x + leftEyeInner.x) / 2;

                                    // Calculate deviation of nose tip from eye midpoint, relative to eye width
                                    const relativeYawDeviation = (noseTip.x - eyeMidX) / eyeWidth;
                                    console.log(`[Pose Yaw] Dev: ${relativeYawDeviation.toFixed(4)}`); // DEBUG

                                    // Check if absolute deviation exceeds threshold
                                    const isYawViolation = Math.abs(relativeYawDeviation) > YAW_THRESHOLD;
                                    // console.log(`[Pose Yaw] Violation: ${isYawViolation}`); // DEBUG
                                    if (isYawViolation) {
                                        lookingAway = true;
                                        poseReason = 'yaw';
                                    }
                                }

                                // --- Pitch Calculation ---
                                const faceHeight = Math.abs(foreheadTop.y - chinBottom.y);
                                // console.log(`[Pose Pitch] faceHeight: ${faceHeight.toFixed(4)}`); // DEBUG

                                if (faceHeight > 0) {
                                    // Calculate vertical distance between 'between eyes' and nose tip, relative to face height
                                    const eyeNoseDistY = noseTip.y - betweenEyes.y;
                                    let relativePitchDeviation = eyeNoseDistY / faceHeight;
                                    relativePitchDeviation = Math.abs(relativePitchDeviation) - 0.22; // Ensure it's positive
                                    console.log(`[Pose Pitch] Raw Dev: ${(relativePitchDeviation).toFixed(4)} (Threshold: +/-${PITCH_THRESHOLD})`); // DEBUG with raw value

                                    const isPitchViolation = Math.abs(relativePitchDeviation) > PITCH_THRESHOLD || relativePitchDeviation - 0.22 > PITCH_THRESHOLD;
                                    // console.log(`[Pose Pitch] Abs Dev: ${Math.abs(relativePitchDeviation).toFixed(4)}, Violation: ${isPitchViolation}`); // DEBUG

                                    if (isPitchViolation && !lookingAway) { // Only set if yaw wasn't already true
                                        lookingAway = true;
                                        poseReason = 'pitch';
                                    }
                                }

                                // --- Update Status based on combined pose ---
                                    if (lookingAway) {
                                        console.log(`[Pose] Status Update: Looking Away (${poseReason})`); // DEBUG
                                        setDetectionStatus('Please look at the screen.');
                                    } // else keep 'Face detected' status
                                // <-- REMOVE EXTRA BRACE HERE
                            } else {
                                console.warn("[Pose Check] Not enough landmarks detected for pose estimation.");
                            } // End landmark check
                            // --- End Head Pose Estimation ---

                            // --- Calculate Bounding Box from Landmarks ---
                            // (FaceMesh doesn't provide a direct boundingBox like FaceDetection)
                            let minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;
                            for (const landmark of landmarks) {
                                minX = Math.min(minX, landmark.x);
                                minY = Math.min(minY, landmark.y);
                                maxX = Math.max(maxX, landmark.x);
                                maxY = Math.max(maxY, landmark.y);
                            }
                            const width = maxX - minX;
                            const height = maxY - minY;

                            // Convert normalized coordinates to pixel values
                            calculatedBox = {
                                x: minX * videoDimensionsRef.current.width,
                                y: minY * videoDimensionsRef.current.height,
                                width: width * videoDimensionsRef.current.width,
                                height: height * videoDimensionsRef.current.height,
                            };
                            // --- End Bounding Box Calculation ---

                        } else {
                             console.log("[handleResults] Video element NOT ready or landmarks missing. Skipping processing.");
                        }
                    } else { // More than 1 face
                        setDetectionStatus('Multiple faces detected! Please ensure only one face is visible.');
                    }

                    // Update looking away state
                    console.log(`[Pose] Setting isLookingAway state to: ${lookingAway}`); // DEBUG
                    setIsLookingAway(lookingAway);
                    // Update face box state (will be null if no face or multiple faces)
                    setFaceDetectedBox(calculatedBox);
                };

                faceMeshInstance.onResults(handleResults); // Use the instance variable
                resultsListenerAdded.current = true;

                // Set FaceMesh options
                faceMeshInstance.setOptions({ // Use the instance variable
                    maxNumFaces: 5, // <-- INCREASE THIS VALUE to detect multiple faces (e.g., 5)
                    refineLandmarks: true, // Get more accurate landmarks
                    // staticImageMode: false, // Ensure it's set for video streams
                    minDetectionConfidence: 0.6, // INCREASED slightly
                    minTrackingConfidence: 0.6  // INCREASED slightly
                });
                await faceMeshInstance.initialize(); // <-- FIX: Use faceMeshInstance variable

                setDetectorReady(true);
                setDetectionStatus('Detector ready.');
                console.log('useMediaPipeFaceDetection: MediaPipe Face Detector ready.');
                detectorRef.current = faceMeshInstance; // Store the correct instance in the ref
            } catch (err) {
                console.error('useMediaPipeFaceDetection: Error during detector initialization:', err);
                setDetectionStatus(`Error initializing detector: ${err.message}`);
                setDetectorReady(false);
                setNumberOfFaces(0);
                setFaceDetectedBox(null);
            }
        };

        initialize();

        // Cleanup
        return () => {
             if (detectorRef.current && typeof detectorRef.current.close === 'function') {
                detectorRef.current.close();
                console.log('useMediaPipeFaceDetection: Detector closed.');
            }
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            setDetectorReady(false);
            setNumberOfFaces(0);
            setIsLookingAway(false); // Reset pose state
            setFaceDetectedBox(null);
            setDetectionStatus('Detector closed.');
        };
    }, [videoRef]); // videoRef is the only dependency needed here

     // --- Function to Send Frame for Detection ---
    // (Includes status update refinement from previous step)
    const sendFrameForDetection = useCallback(async () => {
        // console.log("[sendFrame] Called."); // Keep logging enabled for debugging
        const videoElement = videoRef.current;
        const detector = detectorRef.current;
        let videoStillNotReady = false; // Flag

        // --- Core Checks (Keep these) ---
        if (!detectorReady) { console.warn("[sendFrame] Exit: detector not ready"); return; }
        if (!detector) { console.warn("[sendFrame] Exit: detector ref null"); return; }
        if (!resultsListenerAdded.current) { console.warn("[sendFrame] Exit: results listener not added"); return; }
        if (!videoElement) { console.warn("[sendFrame] Exit: video element null"); return; }
        if (videoElement.paused) { console.warn("[sendFrame] Exit: video paused"); return; }
        if (videoElement.ended) { console.warn("[sendFrame] Exit: video ended"); return; }

        // --- Video Readiness Checks & Dimension Update ---
        if (videoElement.readyState < 3) { // HAVE_FUTURE_DATA
            console.warn(`[sendFrame] Video not ready: readyState is ${videoElement.readyState} (< 3).`);
            videoStillNotReady = true;
        }
        // Check and store video dimensions if they are valid and changed
        if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            if (videoDimensionsRef.current.width !== videoElement.videoWidth || videoDimensionsRef.current.height !== videoElement.videoHeight) {
                videoDimensionsRef.current = { width: videoElement.videoWidth, height: videoElement.videoHeight };
                console.log(`[sendFrame] Updated video dimensions: ${videoDimensionsRef.current.width}x${videoDimensionsRef.current.height}`);
            }
        } else {
            console.warn("[sendFrame] Video not ready: videoWidth is 0.");
            videoStillNotReady = true;
        }
        // --- Status Update and Return if Video Not Ready ---
        if (videoStillNotReady) {
            setDetectionStatus(prevStatus => {
                const waitingMsg = 'Waiting for video frame data...';
                if (prevStatus !== waitingMsg) {
                    console.log("[sendFrame] Updating status to indicate waiting for video frame data.");
                    return waitingMsg;
                }
                return prevStatus; // Avoid unnecessary state update
            });
            return; // Stop processing this frame
        }
        // --- End Status Update ---

        // --- If Video IS Ready, Ensure Status Reflects Active Detection ---
        setDetectionStatus(prevStatus => {
             // If it was waiting, mark as active now. Otherwise, keep existing active/face status.
             if (prevStatus === 'Waiting for video frame data...') {
                 console.log("[sendFrame] Video frame data ready, setting status to 'Detection active.'");
                 return 'Detection active.';
             }
             // If status is already related to face count, keep it.
             if (prevStatus.includes('face detected')) {
                 return prevStatus;
             }
             // Otherwise, ensure it's generally 'active' if not waiting or showing face count.
             if (prevStatus !== 'Detection active.') {
                 return 'Detection active.';
             }
             return prevStatus;
        });

        // --- Proceed with Detection ---
        // console.log("[sendFrame] All checks passed. Calling detector.send...");
        try {
            if (typeof detector.send !== 'function') {
                 console.error("detector.send is not a function");
                 setDetectionStatus('Error: detector.send not available.');
                 return;
            }
            await detector.send({image: videoElement});
            // Results handled by onResults listener
        } catch (error) {
            console.error("useMediaPipeFaceDetection: Error sending frame:", error);
            setDetectionStatus(`Error during detection: ${error.message}`);
            // Reset state on error? Maybe let onResults handle lack of detections.
            setFaceDetectedBox(null);
            setNumberOfFaces(0);
            setIsLookingAway(false); // Reset pose state
        }
    }, [detectorReady, videoRef]);

     // --- Start/Stop Detection Interval ---
    // (No changes needed here, logic is sound)
    useEffect(() => {
        console.log(`[Interval Effect Check] Running. isCameraActive=${isCameraActive}, detectorReady=${detectorReady}`); // Log dependencies

        // --- Condition now ONLY depends on camera intent and detector readiness ---
        if (isCameraActive && detectorReady) {
            console.log("useMediaPipeFaceDetection: Conditions met (Camera Active, Detector Ready). Starting detection interval.");
            // Set initial status, sendFrameForDetection will refine if video isn't ready yet
            setDetectionStatus('Detection active.');

            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current); // Clear just in case
            }
            sendFrameForDetection(); // Run once immediately
            detectionIntervalRef.current = setInterval(sendFrameForDetection, DETECTION_INTERVAL_MS);

        } else {
            // Conditions not met, ensure interval is cleared
            if (detectionIntervalRef.current) {
                console.log("useMediaPipeFaceDetection: Clearing detection interval (conditions not met: cameraActive or detectorReady).");
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }

            // Update status based on why it's not running
            if (!detectorReady) {
                setDetectionStatus('Waiting for detector...');
            } else if (!isCameraActive) {
                setDetectionStatus('Camera off.');
            } else {
                 setDetectionStatus('Detection stopped.'); // General fallback
            }

            // Ensure state is reset if detection stops/isn't running
            if (faceDetectedBox !== null) setFaceDetectedBox(null);
            if (numberOfFaces !== 0) setNumberOfFaces(0);
            if (isLookingAway) setIsLookingAway(false); // Reset pose state
        }

        // Cleanup function for THIS effect instance
        return () => {
            console.log("useMediaPipeFaceDetection: Interval Effect Cleanup.");
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            // Optionally reset status/state here too, though the main block handles it
            // setDetectionStatus('Detection stopped.');
            // setFaceDetectedBox(null);
            // setNumberOfFaces(0);
            // setIsLookingAway(false);
        };

    // Dependencies: isCameraActive, detectorReady, sendFrameForDetection (stable), videoRef (stable)
    }, [isCameraActive, detectorReady, sendFrameForDetection, videoRef]);
    // --- END SIMPLIFICATION ---


    // --- Function to get the latest detected box (for capture) ---
    const getLatestDetectedBox = useCallback(() => {
        // This simply reads the latest state, no dependencies needed other than the state itself
        return faceDetectedBox;
    }, [faceDetectedBox]);

    // Return the state and functions needed by the component
    return {
        detectorReady,
        detectionStatus,
        faceDetectedBox,
        isLookingAway, // <-- NEW: Expose head pose status
        getLatestDetectedBox,
        numberOfFacesDetected: numberOfFaces // Return the count
    };
};
