import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import the custom hook
import { useMediaPipeFaceDetection } from '../hooks/useMediaPipeFaceDetection'; // Adjust path if needed
import './Form.css'; // Import the CSS file for styling

const Form = () => {
    // --- State for User Details ---
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [userId, setUserId] = useState(null); // To store the user's ID after submission
    const [warningStartTime, setWarningStartTime] = useState(null); // To track when warning appears

    // --- State for Form Flow & Errors ---
    const [submitted, setSubmitted] = useState(false); // True ONLY when test phase begins
    const [error, setError] = useState('');
    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [cameraError, setCameraError] = useState('');
    const [showScreenShareRequiredError, setShowScreenShareRequiredError] = useState(false);

    // --- State for Camera ---
    const [cameraStream, setCameraStream] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(false); // Represents intent/state
    const [isVideoReady, setIsVideoReady] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null); // Still needed for capture during submit
    const isInitialCameraStopped = useRef(false); // Ref to track if initial camera stop was triggered

    // --- ADDED: State for face detection event timing ---
    const [noFaceStartTime, setNoFaceStartTime] = useState(null);
    const [multipleFaceStartTime, setMultipleFaceStartTime] = useState(null);
    // --- END ADDED ---

    // --- ADDED: State to track the specific type of the current warning ---
    const [currentWarningType, setCurrentWarningType] = useState(null);
    // --- END ADDED ---

    // --- Use the MediaPipe Face Detection Hook ---
    const {
        detectorReady,
        detectionStatus,
        faceDetectedBox,
        getLatestDetectedBox,
        numberOfFacesDetected
    } = useMediaPipeFaceDetection(videoRef, isCameraOn); // Detect when camera should be active

    // --- State for Proctoring/Google Form ---
    const [showInstructions, setShowInstructions] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [showPermissionError, setShowPermissionError] = useState(false);
    const [timer, setTimer] = useState(600);
    const [isTimeOver, setIsTimeOver] = useState(false);
    const [violations, setViolations] = useState(0);
    const googleFormRef = useRef(null);
    const [mediaStream, setMediaStream] = useState(null);
    const [isScreenSharingStopped, setIsScreenSharingStopped] = useState(false);

    // --- Validation Functions (Unchanged) ---
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };
    const validatePhone = (phone) => {
        const phoneRegex = /^[0-9]{10}$/; // Example: 10-digit phone number
        return phoneRegex.test(phone);
    };

    // --- Camera Control Functions ---
    const stopCamera = useCallback(() => {
        console.log("<<< stopCamera called >>>");
        // Use functional state update for cameraStream to avoid stale closures
        setCameraStream(prevStream => {
            if (prevStream) {
                console.log(`Stopping tracks for stream ID: ${prevStream.id}`);
                prevStream.getTracks().forEach(track => {
                    track.stop();
                    console.log(`   Track kind stopped: ${track.kind}, state: ${track.readyState}`);
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = null; // Explicitly clear srcObject
                    console.log("   Cleared video srcObject");
                }
                return null; // Update state to null
            }
            console.log("   No active stream found to stop.");
            return null; // No stream existed, ensure state is null
        });
        // Reset other states reliably after stream handling
        setIsCameraOn(false);
        setIsVideoReady(false);
        console.log("   Camera state set to OFF and NOT READY.");
    }, []); // No dependencies needed

    const startCamera = useCallback(async (phase = 'initial') => {
        // Check if already on/starting to prevent race conditions
        // Use local check before async call
        if (isCameraOn || cameraStream) {
            console.log(`startCamera (${phase}): Already starting/on (isCameraOn: ${isCameraOn}, stream: ${!!cameraStream}). Aborting.`);
            return;
        }
        console.log(`>>> startCamera called for phase: ${phase} >>>`);
        setCameraError('');
        setIsVideoReady(false); // Reset readiness

        // Stop previous stream just in case (should be redundant now, but safe)
        if (cameraStream) {
             console.warn(`startCamera (${phase}): Found existing stream unexpectedly. Stopping it.`);
             stopCamera(); // Use the stop function
        }

        if (!detectorReady) {
            setCameraError("Face detector is not ready yet. Please wait.");
            console.log(`startCamera (${phase}) failed: Detector not ready.`);
            setIsCameraOn(false); // Ensure state reflects failure
            return;
        }

        console.log(`startCamera (${phase}): Requesting user media...`);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            console.log(`startCamera (${phase}): Camera stream obtained:`, stream.id);
            if (!stream.getVideoTracks().length) {
                 stream.getTracks().forEach(t => t.stop()); // Clean up partial stream
                 throw new Error("No video track available.");
            }
            // Set state *after* successful acquisition
            setCameraStream(stream);
            setIsCameraOn(true); // Set intent/state to ON
            console.log(`startCamera (${phase}): State set to ON.`);
        } catch (err) {
            console.error(`startCamera (${phase}): Error accessing camera:`, err.name, err.message);
            let userMessage = "Could not start camera.";
            if (err.name === "NotAllowedError") userMessage = "Camera permission denied. Please allow camera access.";
            else if (err.name === "NotFoundError") userMessage = "No camera found.";
            else if (err.name === "NotReadableError") userMessage = "Camera is already in use.";
            setCameraError(userMessage);
            // Ensure state is fully reset on error
            setCameraStream(null);
            setIsCameraOn(false);
            setIsVideoReady(false);
        }
    // Dependencies: detectorReady (condition), stopCamera (internal safety net)
    // Avoid isCameraOn/cameraStream here to break loops, rely on check inside.
    }, [detectorReady, stopCamera]);


    // --- Effect 1: Initial Camera Start ---
    // This effect runs ONLY when detector becomes ready and form is not submitted.
    useEffect(() => {
        console.log(`Effect 1 (Initial Start Check): submitted=${submitted}, detectorReady=${detectorReady}, isCameraOn=${isCameraOn}`);

        // Start only if: form not submitted, detector ready, AND camera isn't already on.
        if (!submitted && detectorReady && !isCameraOn) {
            console.log(">>> Effect 1: Conditions met. Calling startCamera('initial').");
            startCamera('initial'); // Pass phase for logging
        }
        // NO cleanup function here to stop the camera.
    }, [submitted, detectorReady, isCameraOn, startCamera]); // Depends on conditions and the start function itself


    // --- Effect 2: Stop Initial Camera on Submission or Unmount ---
    // This effect's cleanup handles stopping the camera when the component unmounts
    // OR when we transition *out* of the initial form phase (e.g., when 'submitted' becomes true).
    useEffect(() => {
        // The main body of this effect does nothing.
        return () => {
            // This cleanup runs on unmount OR when 'submitted' changes.
            console.log(`<<< Effect 2 (Stop on Submit/Unmount) Cleanup running. Current submitted state: ${submitted}, isInitialCameraStopped: ${isInitialCameraStopped.current}`);

            // Stop the camera IF:
            // 1. We are unmounting OR 'submitted' has just become true (meaning we are leaving the initial phase)
            // 2. The initial camera hasn't already been explicitly stopped (e.g., by requestScreenCapture)
            // 3. The camera is currently perceived as 'on'
            if (isCameraOn && !isInitialCameraStopped.current) {
                 console.log("<<< Effect 2 Cleanup: Camera is ON and initial stop not triggered yet. Calling stopCamera.");
                 stopCamera();
                 // No need to set isInitialCameraStopped here, stopCamera handles state.
            } else {
                 console.log(`<<< Effect 2 Cleanup: Conditions NOT met (isCameraOn: ${isCameraOn}, initialStopTriggered: ${isInitialCameraStopped.current}). No stop action needed.`);
            }
        };
    // Dependency: 'submitted'. Cleanup runs when submitted changes or on unmount.
    // Include isCameraOn and stopCamera so cleanup uses latest versions.
    }, [submitted, isCameraOn, stopCamera]);


    // --- Effect 3: Stream Assignment and Video Readiness ---
    useEffect(() => {
        const videoElement = videoRef.current;
        let isActive = true; // Flag to prevent state updates after cleanup

        if (isCameraOn && cameraStream && videoElement) {
            console.log(`Effect 3 [stream]: Assigning stream ${cameraStream.id} and setting up listeners.`);
            videoElement.srcObject = cameraStream;
            // Reset readiness flag *before* attaching listeners for the new stream
            if (isVideoReady) {
                console.log("Effect 3 [stream]: Resetting isVideoReady to FALSE before setup.");
                setIsVideoReady(false);
            }

            const handleCanPlay = () => {
                if (!isActive) return;
                console.log("Video Event: 'canplay'");
                videoElement.play().then(() => {
                    if (isActive && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                       console.log("Effect 3 [stream]: Play successful, setting isVideoReady to TRUE");
                       // Only set if not already true to avoid potential loops
                       if (!isVideoReady) setIsVideoReady(true);
                    } else if (isActive) {
                       console.warn("Effect 3 [stream]: Play successful but dimensions 0 or inactive.");
                       if (isVideoReady) setIsVideoReady(false); // Ensure false if dimensions are wrong
                    }
                }).catch(e =>{
                   if (!isActive) return;
                   console.error("Effect 3 [stream]: Play error after canplay:", e.name, e.message);
                   setCameraError(`Video play error: ${e.message}`);
                   setIsVideoReady(false);
                });
           };
           const handleLoadedMetadata = () => {
                if (!isActive) return;
                console.log("Video Event: 'loadedmetadata'");
                if (videoElement.paused) {
                    console.log("Effect 3 [stream]: Video paused after metadata, attempting play...");
                    videoElement.play().catch(e => {
                        if (isActive) console.warn("Effect 3 [stream]: Play attempt after loadedmetadata failed:", e.name);
                    });
                }
            };
            const handleError = (e) => {
                if (!isActive) return;
                console.error("Video Event: 'error'", e);
                setCameraError(`Video element error: ${videoElement.error?.message || 'Unknown error'}`);
                setIsVideoReady(false);
            };

            videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.addEventListener('canplay', handleCanPlay);
            videoElement.addEventListener('error', handleError);

            // Initial play attempt (browser might block this, rely on events)
            console.log("Effect 3 [stream]: Attempting initial play...");
            videoElement.play().catch(e => {
                // This warning is common and often benign if 'canplay' handles it later
                if (isActive) console.warn(`Effect 3 [stream]: Initial play() failed (may be interrupted, waiting for events): ${e.name}`);
            });

            return () => {
                isActive = false;
                console.log(`Effect 3 [stream]: Cleanup for stream ${cameraStream?.id}`);
                videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
                videoElement.removeEventListener('canplay', handleCanPlay);
                videoElement.removeEventListener('error', handleError);
                // Pause is good practice, srcObject clearing is handled by stopCamera
                if (videoElement && !videoElement.paused) {
                    videoElement.pause();
                    console.log("Effect 3 [stream]: Paused video.");
                }
                // Reset readiness on cleanup *only if it was true*
                if (isVideoReady) {
                    console.log("Effect 3 [stream]: Cleanup setting isVideoReady to FALSE.");
                    setIsVideoReady(false);
                }
            };
        } else {
             // Handle case where camera should be off or stream is removed
             if (videoElement) {
                 if (videoElement.srcObject) {
                     console.log("Effect 3 [stream]: Clearing srcObject because stream/camera is off.");
                     videoElement.srcObject = null;
                 }
                 if (!videoElement.paused) {
                     videoElement.pause();
                 }
             }
             // If camera is intended off, ensure readiness is false
             if (!isCameraOn && isVideoReady) {
                 console.log("Effect 3 [stream]: Camera off/stream removed, ensuring isVideoReady is FALSE");
                 setIsVideoReady(false);
             }
        }
    // Dependencies: cameraStream (the source), isCameraOn (controls if we should use the stream)
    }, [cameraStream, isCameraOn]); // isVideoReady is set *by* this effect, DO NOT include.


    // --- Function to Capture Current Face Frame (Synchronous Logic) ---
    // ... (No changes needed here)
    const captureCurrentFaceBase64 = () => {
        console.log("captureCurrentFaceBase64 called!");
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Add check for video dimensions being ready
        if (!video || !canvas || !isVideoReady || video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
            console.error("captureCurrentFaceBase64: Pre-capture checks failed.", {
                videoExists: !!video,
                canvasExists: !!canvas,
                isVideoReady,
                readyState: video?.readyState,
                videoWidth: video?.videoWidth,
                videoHeight: video?.videoHeight
            });
            return { error: "Camera components not ready or video stream issue.", photoBase64: null };
        }
        if (!detectorReady) {
            console.error("captureCurrentFaceBase64: Detector not ready.");
            return { error: "Face detector is not ready.", photoBase64: null };
        }
        if (numberOfFacesDetected !== 1) {
            console.error("captureCurrentFaceBase64: Expected 1 face, found", numberOfFacesDetected);
            return { error: "Please ensure exactly one face is clearly visible.", photoBase64: null };
        }

        console.log("captureCurrentFaceBase64: Getting latest detected face box...");
        const detectedPixelBox = getLatestDetectedBox();

        if (!detectedPixelBox) {
            console.error("captureCurrentFaceBase64: No face detected recently.");
            return { error: "No face detected. Please ensure your face is clearly visible.", photoBase64: null };
        }

        const box = detectedPixelBox;
        console.log(`captureCurrentFaceBase64: Using face box at x:${box.x.toFixed(0)}, y:${box.y.toFixed(0)}, w:${box.width.toFixed(0)}, h:${box.height.toFixed(0)}`);
        const sx = Math.max(0, box.x);
        const sy = Math.max(0, box.y);
        // Ensure width/height don't exceed video dimensions from the starting point
        const sw = Math.min(video.videoWidth - sx, box.width);
        const sh = Math.min(video.videoHeight - sy, box.height);

        if (sw <= 0 || sh <= 0) {
            console.error("captureCurrentFaceBase64: Invalid face dimensions.", { sx, sy, sw, sh, vw: video.videoWidth, vh: video.videoHeight });
            return { error: "Detected face region is invalid. Try repositioning.", photoBase64: null };
        }

        // Use Math.round for canvas dimensions to avoid potential floating point issues
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        const context = canvas.getContext('2d');

        try {
            // Draw the cropped portion of the video onto the canvas
            context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            console.log("captureCurrentFaceBase64: Cropped face drawn onto canvas.");
        } catch (drawError) {
            console.error("captureCurrentFaceBase64: Error drawing cropped face to canvas:", drawError);
            return { error: "Failed to capture frame from video.", photoBase64: null };
        }

        let faceBase64 = '';
        try {
            faceBase64 = canvas.toDataURL('image/jpeg', 0.9); // Use JPEG format, quality 0.9
            if (!faceBase64 || faceBase64 === 'data:,') {
                throw new Error("Generated data URL is invalid or empty.");
            }
            console.log("captureCurrentFaceBase64: Base64 data URL generated.");
            return { error: null, photoBase64: faceBase64 }; // Success
        } catch (toUrlError) {
            console.error("captureCurrentFaceBase64: Error converting canvas to Base64:", toUrlError);
            return { error: "Failed to convert captured image.", photoBase64: null };
        }
    };


    // --- handleSubmit (Modified to capture photo on submit) ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setCameraError(''); // Clear specific camera errors too

        // 1. Validate form fields
        if (!name || !email || !phone || nameError || emailError || phoneError) {
            setError('Please fill in all details correctly before submitting.');
            return;
        }

        // 2. Check camera/face state
        if (!isCameraOn || !isVideoReady) {
            setError('Camera is not ready. Please wait or check permissions.');
            return;
        }
        if (numberOfFacesDetected !== 1) {
            setError('Please ensure exactly one face is clearly visible in the camera.');
            return;
        }

        // 3. Capture the face photo NOW
        console.log("handleSubmit: Attempting to capture face photo...");
        const captureResult = captureCurrentFaceBase64();

        if (captureResult.error || !captureResult.photoBase64) {
            setError(`Failed to capture face photo: ${captureResult.error || 'Unknown reason'}`);
            console.error("handleSubmit blocked: Photo capture failed.", captureResult.error);
            return;
        }

        const capturedPhotoBase64 = captureResult.photoBase64;
        console.log("handleSubmit: Face photo captured successfully.");

        // 4. Prepare data and submit
        const userDetails = { name, email, phone, photoBase64: capturedPhotoBase64 };
        console.log("Submitting form with captured photo...");

        try {
            const response = await fetch('http://localhost:5000/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userDetails),
            });

            const responseBody = await response.text();
            console.log("Submit Response Status:", response.status);

            if (!response.ok) {
                let errorMessage = `Form submission failed (Status: ${response.status})`;
                try { errorMessage = JSON.parse(responseBody).message || errorMessage; } catch (parseErr) { errorMessage = responseBody || errorMessage; }
                throw new Error(errorMessage);
            }

            // --- Success ---
            let data;
            try { data = JSON.parse(responseBody); } catch (parseErr) { data = { message: "Submission successful (non-JSON response)." }; }

            if (data && data.userId) {
                setUserId(data.userId);
                console.log("Submission successful, User ID:", data.userId);
                // Don't stop camera here. Effect 2's cleanup will handle it when 'submitted' becomes true later.
                // Set flag to prevent Effect 2 cleanup from stopping camera if requestScreenCapture stops it first.
                isInitialCameraStopped.current = true; // Mark that we intend to stop/restart
                console.log("handleSubmit success: Marked initial camera stop flag.");
                setShowInstructions(true); // Proceed to instructions
            } else {
                console.error("Submission successful, but User ID not received!");
                setError("Submission succeeded, but failed to get user info.");
            }
        } catch (err) {
            console.error("Caught submission error:", err);
            setError(err.message || 'An unexpected error occurred during submission.');
        }
    };

    // --- Proctoring Log Function (Unchanged) ---
    const sendProctoringLog = useCallback(async (logData) => {
        if (!logData.userId) {
            console.error("Cannot send proctoring log: User ID is missing.");
            return;
        }
        const { userId, triggerEvent, startTime, endTime } = logData;
        const dataToSend = { userId, triggerEvent, startTime, endTime };

        console.log("Sending proctoring log:", dataToSend);
        try {
            const response = await fetch('http://localhost:5000/api/proctoring-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to save proctoring log (Status: ${response.status})`);
            }
            const result = await response.json();
            console.log('Proctoring log saved successfully:', result.message);
        } catch (error) {
            console.error('Error sending proctoring log:', error);
        }
    }, []);

    // --- Face Detection Logging/Warning Trigger (Unchanged Logic, but depends on state) ---
    // ... (No changes needed here)
    useEffect(() => {
        // Only run this logic during the active test phase (AFTER submission and screen share start)
        if (submitted && userId && mediaStream && isCameraOn && isVideoReady) { // Check for mediaStream too
            const currentTime = Date.now();

            // --- Handle NO FACE Detected ---
            if (numberOfFacesDetected === 0) {
                if (noFaceStartTime === null) {
                    setNoFaceStartTime(currentTime);
                    console.log("VIOLATION TRIGGER: No Face Detected");
                    setViolations(prev => prev + 1);
                    setWarningStartTime(currentTime);
                    setCurrentWarningType('no_face');
                    setShowWarning(true);
                    if (multipleFaceStartTime !== null) setMultipleFaceStartTime(null);
                }
            }
            // --- Handle MULTIPLE FACES Detected ---
            else if (numberOfFacesDetected > 1) {
                if (multipleFaceStartTime === null) {
                    setMultipleFaceStartTime(currentTime);
                    console.log("VIOLATION TRIGGER: Multiple Faces Detected");
                    setViolations(prev => prev + 1);
                    setWarningStartTime(currentTime);
                    setCurrentWarningType('multiple_face');
                    setShowWarning(true);
                    if (noFaceStartTime !== null) setNoFaceStartTime(null);
                }
            }
            // --- Handle EXACTLY ONE FACE Detected (Normal state - END of previous warning PERIOD) ---
            else if (numberOfFacesDetected === 1) {
                if (noFaceStartTime !== null) {
                    console.log("LOG EVENT DURATION END: No Face (transition to 1)");
                    sendProctoringLog({ userId: userId, triggerEvent: 'no_face', startTime: noFaceStartTime, endTime: currentTime });
                    setNoFaceStartTime(null);
                }
                if (multipleFaceStartTime !== null) {
                    console.log("LOG EVENT DURATION END: Multiple Faces (transition to 1)");
                    sendProctoringLog({ userId: userId, triggerEvent: 'multiple_face', startTime: multipleFaceStartTime, endTime: currentTime });
                    setMultipleFaceStartTime(null);
                }
                // Also clear warning popup if face becomes valid again
                if (showWarning && (currentWarningType === 'no_face' || currentWarningType === 'multiple_face')) {
                    console.log("Face condition corrected, hiding warning.");
                    setShowWarning(false);
                    setWarningStartTime(null);
                    setCurrentWarningType(null);
                }
            }
        } else {
            // Reset timers if test becomes inactive or prerequisites aren't met
            if (noFaceStartTime !== null) setNoFaceStartTime(null);
            if (multipleFaceStartTime !== null) setMultipleFaceStartTime(null);
        }
    }, [
        numberOfFacesDetected, submitted, userId, mediaStream, isCameraOn, isVideoReady,
        noFaceStartTime, multipleFaceStartTime, sendProctoringLog, showWarning, currentWarningType, // Added showWarning/currentWarningType
        setViolations, setWarningStartTime, setShowWarning, setCurrentWarningType
    ]);


    // --- Field Existence Check (Unchanged) ---
    // ... (No changes needed here)
    const checkFieldExists = async (field, value, setErrorCallback) => {
        if (!value) {
            setErrorCallback(`${field.charAt(0).toUpperCase() + field.slice(1)} is required.`);
            return false;
        }
        if (field === 'email' && !validateEmail(value)) {
             setErrorCallback('Please enter a valid email address.');
             return false;
        }
         if (field === 'phone' && !validatePhone(value)) {
             setErrorCallback('Please enter a valid 10-digit phone number.');
             return false;
         }
        setErrorCallback('');

        try {
            const response = await fetch('http://localhost:5000/api/users/check-field', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field, value }),
            });
            const data = await response.json();
            if (!response.ok) {
                 if (response.status === 409) setErrorCallback(data.message || `${field} already exists.`);
                 else setErrorCallback(data.message || `Error checking ${field}.`);
                 return false;
            } else {
                 setErrorCallback('');
                 return true;
            }
        } catch (err) {
            console.error(`Error checking field ${field}:`, err);
            setErrorCallback('Network error checking field availability.');
            return false;
        }
    };


    // --- Visibility Change Listener (Unchanged Logic) ---
    // ... (No changes needed here)
    useEffect(() => {
        if (submitted && userId && mediaStream) { // Check mediaStream here too
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    console.log("Violation detected: Tab switched");
                    const currentViolationCount = violations + 1;
                    setViolations(currentViolationCount);
                    setWarningStartTime(Date.now());
                    setCurrentWarningType('tab_switch'); // Set type for warning message
                    setIsScreenSharingStopped(false); // Ensure this is false for tab switch
                    setShowWarning(true);
                }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    }, [submitted, userId, violations, mediaStream]); // Added mediaStream


    // --- Timer Logic (Unchanged) ---
    // ... (No changes needed here)
    useEffect(() => {
        // Timer should start only AFTER instructions are agreed and test begins
        if (submitted && mediaStream) { // Check mediaStream
            const interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        setIsTimeOver(true);
                        clearInterval(interval);
                        // Optionally stop camera/screen share here if time runs out
                        if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
                        stopCamera(); // Stop webcam too
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [submitted, mediaStream, stopCamera]); // Added stopCamera dependency


    // --- Screen Capture Request (Modified to manage camera stop/start) ---
    const requestScreenCapture = async () => {
        setShowInstructions(false); // Close instructions popup first
        isInitialCameraStopped.current = false; // Reset flag before attempting screen share

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false,
            });

            setMediaStream(stream);
            console.log('Screen sharing started successfully!');

            // Explicitly stop the initial camera BEFORE starting the test phase camera
            console.log('requestScreenCapture: Stopping initial camera...');
            stopCamera();
            isInitialCameraStopped.current = true; // Mark that we handled the stop

            // Use setTimeout to allow hardware/browser to release the camera before restarting
            setTimeout(() => {
                console.log('requestScreenCapture: Delay finished. Requesting camera start for test phase...');
                startCamera('test'); // Pass phase for logging
            }, 200); // Increased delay slightly (e.g., 200ms)

            setSubmitted(true); // <<< SET SUBMITTED TO TRUE HERE TO START TEST PHASE

            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.onended = () => {
                // Check if still submitted before triggering violation
                if (submitted) {
                    setIsScreenSharingStopped(true); // Set flag first
                    handleStopSharingViolation();
                } else {
                    console.log("Screen sharing ended, but test not submitted. Ignoring.");
                }
            };
        } catch (error) {
            console.error('Error requesting screen capture:', error);
            // Don't set submitted=true if permission denied
            setShowPermissionError(true);
            // Ensure camera state is consistent if screen share fails
            if (isCameraOn) {
                console.log("Screen share failed, ensuring initial camera is stopped.");
                stopCamera();
            }
        }
    };

    // --- Stop Sharing Violation Handler (Unchanged) ---
    // ... (No changes needed here)
    const handleStopSharingViolation = () => {
        console.log("Violation detected: Screen sharing stopped");
        // Stop the stream tracks if they exist
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
        }
        setMediaStream(null); // Clear the state

        const currentViolationCount = violations + 1;
        setViolations(currentViolationCount);
        setWarningStartTime(Date.now());
        setCurrentWarningType('screenshare_stop'); // Set type
        // isScreenSharingStopped is already set true by onended handler
        setShowWarning(true);
    };


    // --- Screenshot Capture & Save (Unchanged Logic) ---
    // ... (No changes needed here)
    const captureScreenshot = useCallback(() => {
        if (!mediaStream || !mediaStream.active) {
            console.warn('Screenshot capture skipped: Media stream is not available or inactive.');
            return;
        }
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== 'live') {
            console.warn('Screenshot capture skipped: Video track is not available or not live.');
            return;
        }

        // Use try-catch for ImageCapture constructor as it can fail
        try {
            const imageCapture = new ImageCapture(videoTrack);
            imageCapture.grabFrame()
                .then((bitmap) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    const context = canvas.getContext('2d');
                    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                    const screenshot = canvas.toDataURL('image/png');
                    saveScreenshotToServer(screenshot); // Call the async function
                    console.log('Screenshot captured successfully!');
                })
                .catch((error) => {
                    // Handle specific errors if possible
                    if (error.name === 'InvalidStateError') {
                        console.error('Error capturing screenshot (InvalidStateError): Track state is invalid.', error);
                    } else {
                        console.error('Error grabbing screenshot frame:', error);
                    }
                });
        } catch (error) {
             console.error('Error creating ImageCapture:', error);
        }
    }, [mediaStream]); // Dependency is correct

    const saveScreenshotToServer = async (screenshot) => {
        // Ensure userId is available before sending
        if (!userId) {
            console.error('Error saving screenshot: User ID is not available.');
            // Optionally show an error to the user
            return;
        }
 
        try {
            const response = await fetch('http://localhost:5000/api/screenshots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send both screenshot and userId
                body: JSON.stringify({ screenshot, userId }), // <-- UPDATED HERE
            });
 
            // It's good practice to check the response status
            const responseData = await response.json(); // Try parsing JSON response
 
            if (!response.ok) {
                 // Use message from backend if available, otherwise throw generic error
                throw new Error(responseData.message || `Failed to save screenshot (Status: ${response.status})`);
            }
 
            console.log('Screenshot saved successfully via backend:', responseData); // Log backend response
 
        } catch (error) {
            console.error('Error saving screenshot:', error);
            // Optionally, display this error to the user
        }
    };
    // --- END UPDATED Function ---


    // --- Screenshot Interval (Unchanged) ---
    // ... (No changes needed here)
    useEffect(() => {
        if (submitted && mediaStream && userId) {
            const interval = setInterval(() => {
                console.log('Capturing periodic screenshot...');
                captureScreenshot();
            }, 1 * 30 * 1000); // 2 minutes
            return () => clearInterval(interval);
        }
    }, [submitted, mediaStream, captureScreenshot, userId]);


    // --- Media Stream Cleanup (Unchanged) ---
    // ... (No changes needed here)
    useEffect(() => {
        return () => {
            if (mediaStream) {
                console.log("Cleaning up mediaStream (screen share) on unmount.");
                mediaStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [mediaStream]);

    // ... (No changes needed here)
    const isSubmitDisabled =
        !name || !!nameError ||
        !email || !!emailError ||
        !phone || !!phoneError ||
        !isCameraOn || !isVideoReady || // Camera must be fully ready
        numberOfFacesDetected !== 1 || // Exactly one face must be detected
        !detectorReady; // Detector must be ready


    // --- JSX Rendering ---
    return (
        <div className="form-container">

            {/* --- Initial Form OR Test Area --- */}
            {!showInstructions && !submitted ? ( // Show form if instructions aren't shown AND test hasn't started
                <form className="form-card" onSubmit={handleSubmit}>
                    <h2>Submit Your Details</h2>
                    {/* ... (Name, Email, Phone inputs - unchanged) ... */}
                     <div className="form-group">
                        <label htmlFor="name">Name:</label>
                        <input
                            type="text" id="name" value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => checkFieldExists('name', name, setNameError)}
                            required aria-invalid={!!nameError} aria-describedby="name-error"
                        />
                        {nameError && <p id="name-error" className={`error-message ${nameError ? 'visible' : ''}`}>{nameError}</p>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email" id="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => checkFieldExists('email', email, setEmailError)}
                            required aria-invalid={!!emailError} aria-describedby="email-error"
                        />
                        {emailError && <p id="email-error" className={`error-message ${emailError ? 'visible' : ''}`}>{emailError}</p>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">Phone Number:</label>
                        <input
                            type="tel" id="phone" value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onBlur={() => checkFieldExists('phone', phone, setPhoneError)}
                            required aria-invalid={!!phoneError} aria-describedby="phone-error"
                        />
                        {phoneError && <p id="phone-error" className={`error-message ${phoneError ? 'visible' : ''}`}>{phoneError}</p>}
                    </div>


                    {/* --- Camera Section (Simplified) --- */}
                    <div className="form-group camera-section">
                        

                        {/* Camera Error Display */}
                        {cameraError && <p className="error-message visible">{cameraError}</p>}

                        {/* Detection Status & Warnings */}
                        
                        {isCameraOn && isVideoReady && numberOfFacesDetected > 1 && (
                            <p className="error-message visible multiple-faces-warning" style={{ color: 'orange', fontWeight: 'bold' }}>
                                Warning: Multiple faces detected.
                            </p>
                        )}
                         {isCameraOn && isVideoReady && numberOfFacesDetected === 0 && (
                            <p className="error-message visible multiple-faces-warning" style={{ color: 'orange', fontWeight: 'bold' }}>
                                Warning: No face detected.
                            </p>
                        )}

                        {/* Live feed container */}
                        <div className="camera-live-container">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted // Ensure muted
                                className="camera-video-feed"
                                style={{ display: isCameraOn ? 'block' : 'none', transform: 'scaleX(-1)' }} // Flip horizontally
                            ></video>
                            {/* Placeholder when camera is off */}
                            {!isCameraOn && <div className="camera-placeholder-box">Camera starting...</div>}
                            {/* Hidden canvas for capture */}
                            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                        </div>
                    </div>
                    {/* --- End Camera Section --- */}

                    {/* General Form Error */}
                    {error && <p className="error-message visible">{error}</p>}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="submit-button"
                        disabled={isSubmitDisabled} // Use the calculated disabled state
                    >
                        {isSubmitDisabled
                            ? !detectorReady
                                ? 'Loading Detector...'
                                : !isCameraOn
                                ? 'Starting Camera...'
                                : !isVideoReady
                                ? 'Initializing Camera...'
                                : (!name || !!nameError || !email || !!emailError || !phone || !!phoneError)
                                ? 'Capture & Submit'
                                : numberOfFacesDetected !== 1
                                ? 'Align Face (1 needed)'
                                : 'Check Conditions' // Fallback disabled text
                            : 'Submit Details'}
                    </button>
                </form>
            ) : submitted && mediaStream ? ( // Test Area (Test Started and Screen Sharing Active)
                <div className="google-form-page">
                    <div className="google-form-container" ref={googleFormRef}>
                        <div className="timer-container">
                            <p className="custom-timer">Time remaining: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</p>
                        </div>
                        <div className="camera-feed">
                            <div className="camera-box">
                                {cameraError && <p className="error-message camera-error">{cameraError}</p>}
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted // Ensure muted
                                    className={`camera-video ${cameraError ? 'hidden' : ''}`}
                                    style={{ transform: 'scaleX(-1)' }} // Flip horizontally
                                ></video>
                                {/* Show placeholder if camera is intended ON but not ready/error */}
                                {isCameraOn && !isVideoReady && !cameraError && <p className="camera-placeholder">Initializing...</p>}
                                {/* Show placeholder if camera is OFF */}
                                {!isCameraOn && !cameraError && <p className="camera-placeholder">Camera off</p>}
                            </div>
                        </div>
                        <iframe
                            src="https://docs.google.com/forms/d/e/1FAIpQLSdjoWcHb2PqK1BXPp_U8Z-AYHyaimZ4Ko5-xvmNOOuQquDOTQ/viewform?embedded=true"
                            className="google-form-iframe"
                            title="Google Form Test"
                            frameBorder="0" marginHeight="0" marginWidth="0"
                        >Loading…</iframe>
                    </div>
                    <p className="violations-info">Violations: {violations}</p>
                </div>
            ) : submitted && !mediaStream && !showPermissionError ? ( // Waiting for screen share after agreeing
                 <div className="loading-message">
                    <p>Waiting for screen sharing permission...</p>
                    {/* Optionally add a cancel button here? */}
                 </div>
            ) : null /* Render nothing if instructions are shown or other intermediate states */ }


            {/* --- Popups (Rendered on top) --- */}

            {/* Instructions Popup */}
            {/* ... (No changes needed here) ... */}
             {showInstructions && (
                <div className="popup-overlay">
                    <div className="popup">
                        <h2>Instructions</h2>
                        <div className="instructions-list">
                             <p>You will have <strong>{Math.floor(600 / 60)} minutes</strong> to complete the test.</p>
                             <p>Ensure you complete the test within the time limit shown in the top-right corner.</p>
                             <p>During the test, <strong>do not</strong> perform any of the following actions:</p>
                             <ul>
                                 <li>Switch to another application or program.</li>
                                 <li>Switch to another browser tab or window.</li>
                                 <li>Minimize the browser window.</li>
                                 <li>Turn off your screen or let your computer go to sleep.</li>
                                 <li>Interact with notifications (e.g., clicking on them).</li>
                                 <li>Disconnect from the internet or lose network connectivity.</li>
                                 <li>Close the browser or refresh the page.</li>
                                 <li>Stop sharing your screen.</li>
                                 <li>Obscure your face or allow others into the camera view.</li>
                             </ul>
                             <p>If you perform any of the above actions:</p>
                             <ul>
                                 <li>You will receive a warning.</li>
                                 <li>Further violations may lead to disqualification.</li>
                             </ul>
                             <p>Click 'I Agree' below to start the test and share your screen.</p>
                         </div>
                        <button className="agree-button" onClick={requestScreenCapture}>
                            I Agree
                        </button>
                    </div>
                </div>
            )}


            {/* Permission Error Dialog */}
            {/* ... (No changes needed here) ... */}
            {showPermissionError && (
                 <div className="popup-overlay">
                     <div className="popup">
                         <h2>Permission Denied</h2>
                         <p>You have denied screen-sharing permission. You cannot start the test without sharing your screen.</p>
                         <p>Please click 'I Agree' again and allow screen sharing when prompted.</p>
                         <button
                             className="close-button"
                             onClick={() => {
                                 setShowPermissionError(false);
                                 // Re-show instructions so they can click Agree again
                                 setShowInstructions(true);
                             }}
                         >
                             Close
                         </button>
                     </div>
                 </div>
            )}


            {/* Violation Warning Popup */}
            {/* ... (No changes needed here) ... */}
            {showWarning && (
                <div className="popup-overlay">
                    <div className="popup">
                        <h2>Warning</h2>
                        <p>
                            Violation detected ({violations}). Please do not{' '}
                            {currentWarningType === 'tab_switch' ? 'switch tabs or minimize the browser' :
                            currentWarningType === 'screenshare_stop' ? 'stop screen sharing' :
                            currentWarningType === 'no_face' ? 'leave the camera view or obscure your face' :
                            currentWarningType === 'multiple_face' ? 'allow others in the camera view' :
                            'violate the test rules'}
                            {' '}again.
                        </p>
                        <button
                            className="close-button"
                            onClick={() => {
                                const endTime = Date.now();
                                const startTime = warningStartTime;

                                // Log acknowledgement for specific violation types if needed
                                if (startTime && userId && currentWarningType) {
                                    let triggerEventToLog;
                                    let shouldLogPopupClose = false;

                                    switch (currentWarningType) {
                                        case 'tab_switch':
                                            triggerEventToLog = 'tab_switch_ack';
                                            shouldLogPopupClose = true;
                                            break;
                                        case 'screenshare_stop':
                                            triggerEventToLog = 'screenshare_stop_ack';
                                            shouldLogPopupClose = true;
                                            break;
                                        // Don't log ack for face events here, duration is logged elsewhere
                                        case 'no_face':
                                        case 'multiple_face':
                                            console.log(`Warning popup closed for ${currentWarningType}, duration log handled elsewhere.`);
                                            shouldLogPopupClose = false;
                                            break;
                                        default:
                                            triggerEventToLog = 'unknown_warning_ack';
                                            shouldLogPopupClose = true;
                                    }

                                    if (shouldLogPopupClose) {
                                        sendProctoringLog({
                                            userId: userId,
                                            triggerEvent: triggerEventToLog,
                                            startTime: startTime, // When violation *started*
                                            endTime: endTime,     // When user closed popup
                                        });
                                    }
                                } else {
                                     console.error("Could not process warning interaction log: startTime, userId, or currentWarningType missing.", { startTime, userId, currentWarningType });
                                }

                                // Reset warning states
                                setShowWarning(false);
                                setWarningStartTime(null);
                                setCurrentWarningType(null);

                                // If warning was due to screen share stop, show the persistent error prompt
                                if (isScreenSharingStopped) {
                                    setShowScreenShareRequiredError(true);
                                    setIsScreenSharingStopped(false); // Reset flag after handling
                                }
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}


            {/* Persistent Screen Share Required Error Popup */}
            {/* ... (No changes needed here) ... */}
            {showScreenShareRequiredError && (
                <div className="popup-overlay">
                    <div className="popup">
                        <h2>Screen Sharing Required</h2>
                        <p>Screen sharing was stopped or is not active. Please allow screen sharing to continue the test.</p>
                        <button
                            className="agree-button" // Re-use style
                            onClick={() => {
                                setShowScreenShareRequiredError(false); // Close this popup
                                requestScreenCapture(); // Attempt to get permission again
                            }}
                        >
                            Allow Screen Sharing
                        </button>
                    </div>
                </div>
            )}


            {/* Time Over Popup */}
            {/* ... (No changes needed here) ... */}
            {submitted && isTimeOver && (
                 <div className="popup-overlay">
                     <div className="popup blocked-message">
                        <h2>Time Over</h2>
                        <p>Your time for the test has expired.</p>
                     </div>
                </div>
            )}

            {/* --- End Popups --- */}

        </div> // End form-container
    );
};

export default Form;