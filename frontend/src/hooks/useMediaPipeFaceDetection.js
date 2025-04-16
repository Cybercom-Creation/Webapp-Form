// // src/hooks/useMediaPipeFaceDetection.js
// import { useState, useEffect, useRef, useCallback } from 'react';

// // --- Configuration ---
// const DETECTION_INTERVAL_MS = 500; // How often to run detection while camera is on

// export const useMediaPipeFaceDetection = (videoRef, isCameraActive) => {
//     const [detectorReady, setDetectorReady] = useState(false);
//     const [detectionStatus, setDetectionStatus] = useState('Initializing detector...');
//     const [faceDetectedBox, setFaceDetectedBox] = useState(null); // Stores { x, y, width, height } in PIXELS
//     const detectorRef = useRef(null);
//     const detectionIntervalRef = useRef(null);
//     const resultsListenerAdded = useRef(false); // Track if listener is set

//     // --- Initialize TFJS Backend and MediaPipe Detector ---
//     useEffect(() => {
//         const initialize = async () => {
//             setDetectionStatus('Checking for MediaPipe/TFJS...');

//             // Access libraries from window object
//             const mpFaceDetection = window.FaceDetection;
//             const tf = window.tf;

//             if (!mpFaceDetection || !tf || !tf.setBackend) {
//                  console.error("MediaPipe FaceDetection or TensorFlow.js not found on window object. Check CDN scripts in index.html.");
//                  setDetectionStatus('Error: Required libraries not loaded.');
//                  return;
//             }

//             setDetectionStatus('Setting up TFJS backend...');
//             try {
//                 await tf.setBackend('webgl');
//                 await tf.ready();
//                 console.log('useMediaPipeFaceDetection: TFJS WebGL backend ready.');

//                 setDetectionStatus('Loading MediaPipe Face Detector model...');

//                 // Create the detector instance using the global class
//                 const detector = new mpFaceDetection({locateFile: (file) => {
//                     // Point to the CDN location for model files
//                     return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
//                 }});

//                 // Set options
//                 detector.setOptions({
//                     model: 'short', // Use 'short' range model
//                     minDetectionConfidence: 0.5, // Confidence threshold
//                 });

//                 // --- Set up the onResults listener ONCE ---
//                 detector.onResults((results) => {
//                     if (results.detections && results.detections.length > 0) {
//                         // Process results (convert box) only if needed
//                         const videoElement = videoRef.current;
//                         if (videoElement && videoElement.videoWidth > 0) {
//                              const pixelBox = normalizeBox(results.detections[0], videoElement.videoWidth, videoElement.videoHeight);
//                              setFaceDetectedBox(pixelBox); // Update state with the latest box
//                         } else {
//                              setFaceDetectedBox(null); // Clear if video dimensions are invalid
//                         }
//                     } else {
//                         setFaceDetectedBox(null); // Clear if no detections
//                     }
//                 });
//                 resultsListenerAdded.current = true;
//                 // --- End Listener Setup ---

//                 // Initialize the detector (loads models)
//                 await detector.initialize();

//                 detectorRef.current = detector;
//                 setDetectorReady(true);
//                 setDetectionStatus('Detector ready.');
//                 console.log('useMediaPipeFaceDetection: MediaPipe Face Detector ready.');

//             } catch (err) {
//                 console.error('useMediaPipeFaceDetection: Error during detector initialization:', err);
//                 setDetectionStatus(`Error initializing detector: ${err.message}`);
//                 setDetectorReady(false);
//             }
//         };

//         initialize();

//         // Cleanup detector on hook unmount
//         return () => {
//             if (detectorRef.current && typeof detectorRef.current.close === 'function') {
//                 detectorRef.current.close();
//                 console.log('useMediaPipeFaceDetection: Detector closed.');
//             }
//             if (detectionIntervalRef.current) {
//                 clearInterval(detectionIntervalRef.current);
//             }
//         };
//     }, [videoRef]); // Add videoRef dependency

//     // --- Convert MediaPipe Normalized Box to Pixel Box ---
//     // Needs adjustment for the CDN version's output format
//     const normalizeBox = useCallback((detection, videoWidth, videoHeight) => {
//         if (!detection || !detection.boundingBox || !videoWidth || !videoHeight) return null;
//         // CDN version often returns boundingBox: { xCenter, yCenter, width, height } (normalized)
//         const box = detection.boundingBox;
//         const xMin = box.xCenter - box.width / 2;
//         const yMin = box.yCenter - box.height / 2;

//         return {
//             x: xMin * videoWidth,
//             y: yMin * videoHeight,
//             width: box.width * videoWidth,
//             height: box.height * videoHeight,
//         };
//     }, []); // No dependencies needed here

//     // --- Function to Send Frame for Detection ---
//     const sendFrameForDetection = useCallback(async () => {
//         const videoElement = videoRef.current;
//         const detector = detectorRef.current;

//         // Check all conditions before sending
//         if (!detectorReady || !detector || !resultsListenerAdded.current || !videoElement || videoElement.paused || videoElement.ended || videoElement.readyState < 3 || videoElement.videoWidth === 0) {
//             // Don't log excessively, just ensure state is clear if needed
//             if (faceDetectedBox !== null) setFaceDetectedBox(null);
//             return;
//         }

//         try {
//             if (typeof detector.send !== 'function') {
//                  console.error("detector.send is not a function", detector);
//                  setDetectionStatus('Error: detector.send not available.');
//                  return;
//             }
//             // Send the current frame. Results are handled by the onResults listener.
//             await detector.send({image: videoElement});
//         } catch (error) {
//             console.error("useMediaPipeFaceDetection: Error sending frame for detection:", error);
//             setDetectionStatus(`Error during detection: ${error.message}`);
//             setFaceDetectedBox(null); // Clear box on error
//         }
//     }, [detectorReady, videoRef, faceDetectedBox]); // Dependencies

//     // --- Start/Stop Detection Interval ---
//     useEffect(() => {
//         // Start interval only when camera is active AND detector is ready
//         if (isCameraActive && detectorReady) {
//             setDetectionStatus('Starting detection...');
//             console.log("useMediaPipeFaceDetection: Starting detection interval.");
//             if (detectionIntervalRef.current) {
//                 clearInterval(detectionIntervalRef.current); // Clear previous interval if any
//             }
//             // Run detection once immediately, then start interval
//             sendFrameForDetection();
//             detectionIntervalRef.current = setInterval(sendFrameForDetection, DETECTION_INTERVAL_MS);

//             // Cleanup function for THIS effect instance
//             return () => {
//                 console.log("useMediaPipeFaceDetection: Clearing detection interval.");
//                 if (detectionIntervalRef.current) {
//                     clearInterval(detectionIntervalRef.current);
//                     detectionIntervalRef.current = null;
//                 }
//                 setFaceDetectedBox(null); // Clear box when interval stops
//                 setDetectionStatus('Detection stopped.');
//             };
//         } else {
//             // Ensure interval is cleared if conditions are not met
//             if (detectionIntervalRef.current) {
//                 console.log("useMediaPipeFaceDetection: Clearing detection interval (conditions not met).");
//                 clearInterval(detectionIntervalRef.current);
//                 detectionIntervalRef.current = null;
//             }
//             // Update status based on why detection isn't running
//             if (!detectorReady) setDetectionStatus('Waiting for detector...');
//             else if (!isCameraActive) setDetectionStatus('Camera off.');
//             if (faceDetectedBox !== null) setFaceDetectedBox(null); // Clear box if detection stops
//         }
//     }, [isCameraActive, detectorReady, sendFrameForDetection, faceDetectedBox]); // Dependencies

//     // --- Function to get the latest detected box (for capture) ---
//     // With the CDN/onResults pattern, we just return the current state value
//     const getLatestDetectedBox = useCallback(() => {
//         return faceDetectedBox;
//     }, [faceDetectedBox]);


//     // Return the state and functions needed by the component
//     return {
//         detectorReady,
//         detectionStatus,
//         faceDetectedBox,        // The latest detected box (PIXELS) from state
//         getLatestDetectedBox, // Function to retrieve the latest box state
//     };
// };










// src/hooks/useMediaPipeFaceDetection.js
import { useState, useEffect, useRef, useCallback } from 'react';

// --- Configuration ---
const DETECTION_INTERVAL_MS = 500; // How often to run detection while camera is on

export const useMediaPipeFaceDetection = (videoRef, isCameraActive) => {
    const [detectorReady, setDetectorReady] = useState(false);
    const [detectionStatus, setDetectionStatus] = useState('Initializing detector...');
    const [faceDetectedBox, setFaceDetectedBox] = useState(null); // Stores { x, y, width, height } in PIXELS
    const detectorRef = useRef(null);
    const detectionIntervalRef = useRef(null);
    const resultsListenerAdded = useRef(false); // Track if listener is set

    // --- Initialize TFJS Backend and MediaPipe Detector ---
    useEffect(() => {
        const initialize = async () => {
            setDetectionStatus('Checking for MediaPipe/TFJS...');
            const mpFaceDetection = window.FaceDetection;
            const tf = window.tf;

            if (!mpFaceDetection || !tf || !tf.setBackend) {
                 console.error("MediaPipe FaceDetection or TensorFlow.js not found on window object. Check CDN scripts in index.html.");
                 setDetectionStatus('Error: Required libraries not loaded.');
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

                // --- Set up the onResults listener ONCE ---
                // Define the handler separately
                const handleResults = (results) => {
                    if (results.detections && results.detections.length > 0) {
                        const videoElement = videoRef.current;
                        if (videoElement && videoElement.videoWidth > 0) {
                             // Use normalizeBox directly here
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
                             setFaceDetectedBox(null);
                        }
                    } else {
                        setFaceDetectedBox(null);
                    }
                };
                detector.onResults(handleResults); // Assign the handler
                resultsListenerAdded.current = true;
                // --- End Listener Setup ---


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
        };
    // Removed normalizeBox from dependencies as it's stable
    }, [videoRef]); // Only depends on videoRef

    // --- Convert MediaPipe Normalized Box to Pixel Box (kept for reference, but logic moved into onResults) ---
    // const normalizeBox = useCallback((detection, videoWidth, videoHeight) => { ... }, []);

    // --- Function to Send Frame for Detection ---
    const sendFrameForDetection = useCallback(async () => {
        const videoElement = videoRef.current;
        const detector = detectorRef.current;

        // --- FIX: Simplified condition ---
        // Check only essential conditions before sending
        if (!detectorReady || !detector || !resultsListenerAdded.current || !videoElement || videoElement.paused || videoElement.ended || videoElement.readyState < 3 || videoElement.videoWidth === 0) {
            return; // Just return if not ready, onResults will clear the box if needed
        }
        // --- END FIX ---

        try {
            if (typeof detector.send !== 'function') {
                 console.error("detector.send is not a function", detector);
                 setDetectionStatus('Error: detector.send not available.');
                 return;
            }
            await detector.send({image: videoElement});
        } catch (error) {
            console.error("useMediaPipeFaceDetection: Error sending frame for detection:", error);
            setDetectionStatus(`Error during detection: ${error.message}`);
            setFaceDetectedBox(null); // Clear box on error
        }
    // --- FIX: Removed faceDetectedBox from dependencies ---
    }, [detectorReady, videoRef]);
    // --- END FIX ---

    // --- Start/Stop Detection Interval ---
    useEffect(() => {
        if (isCameraActive && detectorReady) {
            setDetectionStatus('Starting detection...');
            console.log("useMediaPipeFaceDetection: Starting detection interval.");
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            sendFrameForDetection(); // Run once immediately
            detectionIntervalRef.current = setInterval(sendFrameForDetection, DETECTION_INTERVAL_MS);

            return () => {
                console.log("useMediaPipeFaceDetection: Clearing detection interval.");
                if (detectionIntervalRef.current) {
                    clearInterval(detectionIntervalRef.current);
                    detectionIntervalRef.current = null;
                }
                setFaceDetectedBox(null);
                setDetectionStatus('Detection stopped.');
            };
        } else {
            if (detectionIntervalRef.current) {
                console.log("useMediaPipeFaceDetection: Clearing detection interval (conditions not met).");
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            if (!detectorReady) setDetectionStatus('Waiting for detector...');
            else if (!isCameraActive) setDetectionStatus('Camera off.');
            if (faceDetectedBox !== null) setFaceDetectedBox(null);
        }
    // --- FIX: Removed faceDetectedBox from dependencies ---
    }, [isCameraActive, detectorReady, sendFrameForDetection]);
    // --- END FIX ---

    // --- Function to get the latest detected box (for capture) ---
    const getLatestDetectedBox = useCallback(() => {
        return faceDetectedBox;
    }, [faceDetectedBox]);


    // Return the state and functions needed by the component
    return {
        detectorReady,
        detectionStatus,
        faceDetectedBox,
        getLatestDetectedBox,
    };
};
