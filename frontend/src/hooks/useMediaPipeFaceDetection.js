import { useState, useEffect, useRef, useCallback } from 'react';

// --- Configuration ---
const DETECTION_INTERVAL_MS = 500; // How often to run detection while camera is on

export const useMediaPipeFaceDetection = (videoRef, isCameraActive, isVideoReady) => {
    const [detectorReady, setDetectorReady] = useState(false);
    const [detectionStatus, setDetectionStatus] = useState('Initializing detector...');
    const [faceDetectedBox, setFaceDetectedBox] = useState(null);
    const [numberOfFaces, setNumberOfFaces] = useState(0);
    const detectorRef = useRef(null);
    const detectionIntervalRef = useRef(null);
    const resultsListenerAdded = useRef(false);

    // --- Initialize TFJS Backend and Medi
    // aPipe Detector ---
    useEffect(() => {
        const initialize = async () => {
            setDetectionStatus('Checking for MediaPipe/TFJS...');
            const mpFaceDetection = window.FaceDetection;
            const tf = window.tf;

            if (!mpFaceDetection || !tf || !tf.setBackend) {
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

                setDetectionStatus('Loading MediaPipe Face Detector model...');
                const detector = new mpFaceDetection({locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
                }});

                const handleResults = (results) => {
                    const videoElement = videoRef.current;
                    const detectedFacesCount = results.detections ? results.detections.length : 0;

                    // Update face count state FIRST
                    setNumberOfFaces(detectedFacesCount);

                    // Then update status and box based on the count
                    if (detectedFacesCount === 0) {
                        setDetectionStatus('No face detected. Please position your face.');
                        setFaceDetectedBox(null);
                    } else if (detectedFacesCount === 1) {
                        setDetectionStatus('Face detected. Ready to capture.');
                        if (videoElement && videoElement.videoWidth > 0) {
                             const box = results.detections[0].boundingBox;
                             const xMin = box.xCenter - box.width / 2;
                             const yMin = box.yCenter - box.height / 2;
                             const pixelBox = {
                                 x: xMin * videoElement.videoWidth,
                                 y: yMin * videoElement.videoHeight,
                                 width: box.width * videoElement.videoWidth,
                                 height: box.height * videoElement.videoHeight,
                             };
                             setFaceDetectedBox(pixelBox);
                        } else {
                             setFaceDetectedBox(null); // Video not ready
                        }
                    } else { // More than 1 face
                        setDetectionStatus('Multiple faces detected! Please ensure only one face is visible.');
                        setFaceDetectedBox(null);
                    }
                };

                detector.onResults(handleResults);
                resultsListenerAdded.current = true;

                detector.setOptions({
                    model: 'short',
                    minDetectionConfidence: 0.5,
                });
                await detector.initialize();

                detectorRef.current = detector;
                setDetectorReady(true);
                setDetectionStatus('Detector ready.');
                console.log('useMediaPipeFaceDetection: MediaPipe Face Detector ready.');

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

        // --- Core Checks ---
        if (!detectorReady) { console.warn("[sendFrame] Exit: detector not ready"); return; }
        if (!detector) { console.warn("[sendFrame] Exit: detector ref null"); return; }
        if (!resultsListenerAdded.current) { console.warn("[sendFrame] Exit: results listener not added"); return; }
        if (!videoElement) { console.warn("[sendFrame] Exit: video element null"); return; }
        if (videoElement.paused) { console.warn("[sendFrame] Exit: video paused"); return; }
        if (videoElement.ended) { console.warn("[sendFrame] Exit: video ended"); return; }

        // --- Video Readiness Checks ---
        if (videoElement.readyState < 3) { // HAVE_FUTURE_DATA
            console.warn(`[sendFrame] Video not ready: readyState is ${videoElement.readyState} (< 3).`);
            videoStillNotReady = true;
        }
        if (videoElement.videoWidth === 0) {
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
        console.log("[sendFrame] All checks passed. Calling detector.send...");
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
        }
    }, [detectorReady, videoRef]);

     // --- Start/Stop Detection Interval ---
    // <<< SIMPLIFIED: Removed isVideoReady from condition and dependencies >>>
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
        };

    // <<< Dependencies: isCameraActive, detectorReady, sendFrameForDetection (stable), videoRef (stable) >>>
    // <<< REMOVED isVideoReady >>>
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
        getLatestDetectedBox,
        numberOfFacesDetected: numberOfFaces // Return the count
    };
};
