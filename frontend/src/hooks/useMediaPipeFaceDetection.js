import { useState, useEffect, useRef, useCallback } from 'react';

// --- Configuration ---
const DETECTION_INTERVAL_MS = 500; // How often to run detection while camera is on

export const useMediaPipeFaceDetection = (videoRef, isCameraActive) => {
    const [detectorReady, setDetectorReady] = useState(false);
    const [detectionStatus, setDetectionStatus] = useState('Initializing detector...');
    const [faceDetectedBox, setFaceDetectedBox] = useState(null);
    const [numberOfFaces, setNumberOfFaces] = useState(0);
    const detectorRef = useRef(null);
    const detectionIntervalRef = useRef(null);
    const resultsListenerAdded = useRef(false);

    // --- Initialize TFJS Backend and MediaPipe Detector ---
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
    // This function's identity should only change if detectorReady or videoRef changes.
    const sendFrameForDetection = useCallback(async () => {
        const videoElement = videoRef.current;
        const detector = detectorRef.current;

        // Check conditions before sending
        if (!detectorReady || !detector || !resultsListenerAdded.current || !videoElement || videoElement.paused || videoElement.ended || videoElement.readyState < 3 || videoElement.videoWidth === 0) {
            // No need to reset state here, the interval cleanup or handleResults will do it.
            return;
        }

        try {
            if (typeof detector.send !== 'function') {
                 console.error("detector.send is not a function");
                 setDetectionStatus('Error: detector.send not available.');
                 return;
            }
            // console.log("Sending frame..."); // Optional: Log frame sending
            await detector.send({image: videoElement});
            // Results are handled by the 'onResults' listener
        } catch (error) {
            console.error("useMediaPipeFaceDetection: Error sending frame:", error);
            // Don't set status here if it might conflict with handleResults
            // setDetectionStatus(`Error during detection: ${error.message}`);
            // Let handleResults clear the state if no detections come through after error
        }
    // --- REMOVED faceDetectedBox, numberOfFaces from dependencies ---
    }, [detectorReady, videoRef]);
    // --- END REMOVAL ---

    // --- Start/Stop Detection Interval ---
    // This effect should only re-run if isCameraActive, detectorReady, or the sendFrameForDetection function reference changes.
    useEffect(() => {
        if (isCameraActive && detectorReady) {
            console.log("useMediaPipeFaceDetection: Starting detection interval.");
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current); // Clear just in case
            }
            sendFrameForDetection(); // Run once immediately
            detectionIntervalRef.current = setInterval(sendFrameForDetection, DETECTION_INTERVAL_MS);

            // Cleanup function for THIS effect instance
            return () => {
                console.log("useMediaPipeFaceDetection: Clearing detection interval.");
                if (detectionIntervalRef.current) {
                    clearInterval(detectionIntervalRef.current);
                    detectionIntervalRef.current = null;
                }
                // Reset state when interval stops or dependencies change
                setFaceDetectedBox(null);
                setNumberOfFaces(0);
                setDetectionStatus('Detection stopped.');
            };
        } else {
            // Clear interval if conditions are not met
            if (detectionIntervalRef.current) {
                console.log("useMediaPipeFaceDetection: Clearing detection interval (conditions not met).");
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            // Update status and reset state if detection isn't running
            if (!detectorReady) setDetectionStatus('Waiting for detector...');
            else if (!isCameraActive) setDetectionStatus('Camera off.');

            // Ensure state is reset if detection stops
            if (faceDetectedBox !== null) setFaceDetectedBox(null);
            if (numberOfFaces !== 0) setNumberOfFaces(0);
        }
    // --- REMOVED faceDetectedBox, numberOfFaces from dependencies ---
    }, [isCameraActive, detectorReady, sendFrameForDetection]);
    // --- END REMOVAL ---


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
