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
     const [submitted, setSubmitted] = useState(false);
     const [error, setError] = useState('');
     const [nameError, setNameError] = useState('');
     const [emailError, setEmailError] = useState('');
     const [phoneError, setPhoneError] = useState('');
     const [cameraError, setCameraError] = useState(''); // <-- Add camera error state
     const [showScreenShareRequiredError, setShowScreenShareRequiredError] = useState(false); // State for persistent error
  
     // --- State for Camera ---
     const [cameraStream, setCameraStream] = useState(null); // <-- Add camera stream state
     const [capturedPhoto, setCapturedPhoto] = useState(null); // <-- Add captured photo state (for preview)
     const [isCameraOn, setIsCameraOn] = useState(false); // <-- Add camera on state
     const [isVideoReady, setIsVideoReady] = useState(false); // <-- Add video ready state
     const videoRef = useRef(null); // <-- Add video ref
     const canvasRef = useRef(null); // <-- Add canvas ref

    // --- ADDED: State for face detection event timing ---
    const [noFaceStartTime, setNoFaceStartTime] = useState(null);
    const [multipleFaceStartTime, setMultipleFaceStartTime] = useState(null);
    // --- END ADDED ---

    // --- ADDED: State to track the specific type of the current warning ---
    const [currentWarningType, setCurrentWarningType] = useState(null); 
    // --- END ADDED ---

     // --- Use the MediaPipe Face Detection Hook ---
    // Pass videoRef and boolean indicating if camera feed should be active for detection
    const {
        detectorReady,
        detectionStatus,
        faceDetectedBox,      // The latest box from state (for drawing overlay)
        getLatestDetectedBox, // Function to get the box during capture
        numberOfFacesDetected // <-- Get the face count here (make sure the name matches the hook's return)
    } = useMediaPipeFaceDetection(videoRef,isCameraOn); // Detect when camera on AND video ready

  
     // --- State for Proctoring/Google Form ---
  
     //const [googleFormBlocked, setGoogleFormBlocked] = useState(false);
     const [showInstructions, setShowInstructions] = useState(false); // State to show instructions popup
     const [showWarning, setShowWarning] = useState(false); // State to show warning popup
     const [showPermissionError, setShowPermissionError] = useState(false); // State to show permission error dialog
     const [timer, setTimer] = useState(600); // Timer in seconds
     const [isTimeOver, setIsTimeOver] = useState(false); // State to track if the timer is over
     const [violations, setViolations] = useState(0); // Track the number of violations
     const googleFormRef = useRef(null); // Reference to the Google Form container
     const [mediaStream, setMediaStream] = useState(null); // Store the media stream
     const [isScreenSharingStopped, setIsScreenSharingStopped] = useState(false); // Flag to track if the warning is due to screen sharing being stopped

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone) => {
        const phoneRegex = /^[0-9]{10}$/; // Example: 10-digit phone number
        return phoneRegex.test(phone);
    };

    
    // --- Camera Control Functions ---
    // Wrap startCamera in useCallback to stabilize its reference for useEffect
    const startCamera = useCallback(async () => {
        // Prevent starting if already processing or detector not ready
        if (isCameraOn || !detectorReady) {
             if (!detectorReady) console.log("[startCamera] Prevented: Detector not ready.");
             if (isCameraOn) console.log("[startCamera] Prevented: Camera already considered on.");
             return;
        }
        console.log("[startCamera] Attempting to start camera...");
        setCameraError('');
        setCapturedPhoto(null); // Clear previous photo when starting/retaking
        setIsVideoReady(false); // Reset video readiness

        // Stop existing stream if any (safety check)
        if (cameraStream) {
            console.log("[startCamera] Stopping existing stream first.");
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                });
                console.log("[startCamera] Camera stream obtained:", stream);
                if (!stream.getVideoTracks().length) throw new Error("No video track available.");
                setCameraStream(stream); // Set the new stream
                setIsCameraOn(true); // Mark camera as on (triggers stream assignment effect)
            } catch (err) {
                 console.error("[startCamera] Error accessing camera:", err);
                 let userMessage = "Could not start camera.";
                 if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    userMessage = "Camera permission denied. Please allow camera access in your browser settings and refresh.";
                 } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                    userMessage = "No camera found. Please ensure a camera is connected and enabled.";
                 } else {
                    userMessage = `Could not start camera: ${err.message}`;
                 }
                 setCameraError(userMessage);
                 setCameraStream(null);
                 setIsCameraOn(false); // Ensure camera is marked off on error
                 setIsVideoReady(false);
            }
        } else {
            setCameraError("Your browser does not support camera access (getUserMedia).");
            setIsCameraOn(false);
            setIsVideoReady(false);
        }
    }, [detectorReady, isCameraOn, cameraStream]); // Dependencies for useCallback




    // stopCamera is now primarily used only after successful capture
    const stopCamera = useCallback(() => {
        console.log("[stopCamera] Stopping camera after capture...");
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        setCameraStream(null); // Triggers cleanup
        setIsCameraOn(false); // Mark camera as off
        setIsVideoReady(false); // Mark video as not ready
    }, [cameraStream]);


    // --- useEffect to Auto-Start Camera ---
    useEffect(() => {
        // Log current state values when the effect runs
        console.log("[Auto-Start Effect] Running. Conditions:", {
            submitted,
            detectorReady,
            isCameraOn,
            capturedPhoto
        });

        // Start camera only when the form is NOT submitted,
        // the detector is ready, the camera isn't already considered 'on',
        // and no photo has been captured yet.
        if (!submitted && detectorReady && !isCameraOn && !capturedPhoto) {
            console.log("[Auto-Start Effect] Conditions met! Calling startCamera...");
            startCamera();
        } else {
            // Log why conditions might not be met
            let reason = [];
            if (submitted) reason.push("form submitted");
            if (!detectorReady) reason.push("detector not ready");
            if (isCameraOn) reason.push("camera already on");
            if (capturedPhoto) reason.push("photo already captured");
            console.log(`[Auto-Start Effect] Conditions NOT met. Reasons: ${reason.join(', ') || 'None'}`);
        }

    }, [detectorReady, submitted, isCameraOn, startCamera, capturedPhoto]); // Dependencies

   

 
    

    
    // --- useEffect Hook for stream assignment and video readiness (Unchanged) ---
    useEffect(() => {
        const videoElement = videoRef.current;
        if (isCameraOn && cameraStream && videoElement) {
            videoElement.srcObject = cameraStream;
            // --- DEBUG: Reset isVideoReady explicitly ---
            console.log("useEffect[stream]: Setting isVideoReady to FALSE");
            setIsVideoReady(false);
            const handleCanPlay = () => {
                console.log("Video Event: 'canplay'"); // Log event
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    videoElement.play().then(() => {
                       // --- DEBUG: Log when setting isVideoReady to TRUE ---
                       console.log("useEffect[stream]: Play successful, setting isVideoReady to TRUE");
                       setIsVideoReady(true);
                       // --- END DEBUG ---
                    }).catch(e =>{
                       console.error("useEffect[stream]: Play error after canplay:", e);
                       setCameraError(`Video play error: ${e.message}`);
                       // --- DEBUG: Ensure isVideoReady is FALSE on error ---
                       console.log("useEffect[stream]: Play error, setting isVideoReady to FALSE");
                       setIsVideoReady(false);
                       // --- END DEBUG ---
                    });
                } else {
                   console.warn("Video Event: 'canplay' fired but dimensions are 0");
                }
           };
           const handleLoadedMetadata = () => {
            console.log("Video Event: 'loadedmetadata'"); // Log event
            if (videoElement.paused) {
                videoElement.play().catch(e => console.error("Error playing after loadedmetadata:", e));
             }
        };
        const handleError = (e) => {
            console.error("Video Event: 'error'", e); // Log event
            setCameraError(`Video element error: ${videoElement.error?.message || 'Unknown error'}`);
            // --- DEBUG: Ensure isVideoReady is FALSE on error ---
            console.log("useEffect[stream]: Video error, setting isVideoReady to FALSE");
            setIsVideoReady(false);
            // --- END DEBUG ---
        };
            videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.addEventListener('canplay', handleCanPlay);
            videoElement.addEventListener('error', handleError);
            videoElement.play().catch(e => {
                console.warn("useEffect[stream]: Initial play() failed (may be interrupted):", e);
                // Don't set isVideoReady here, rely on events
            });
            return () => {
                console.log("useEffect[stream]: Cleanup");
                videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
                videoElement.removeEventListener('canplay', handleCanPlay);
                videoElement.removeEventListener('error', handleError);
                if (videoElement) videoElement.pause();
                // --- DEBUG: Ensure isVideoReady is FALSE on cleanup ---
                console.log("useEffect[stream]: Cleanup, setting isVideoReady to FALSE");
                setIsVideoReady(false);
                // --- END DEBUG ---
            };
        } else {
             if (videoElement && !isCameraOn) {
                 videoElement.pause();
                 if (videoElement.srcObject) videoElement.srcObject = null;
                 // --- DEBUG: Ensure isVideoReady is FALSE when camera turns off ---
                 if (isVideoReady) {
                    console.log("useEffect[stream]: Camera off, setting isVideoReady to FALSE");
                    setIsVideoReady(false);
                 }
                 // --- END DEBUG ---
             }
        }
    }, [cameraStream, isCameraOn]); // Dependencies are correct

 // --- Capture Photo (Cropped Face) & Convert to Base64 ---
 const capturePhoto = () => {
    // --- DEBUG: Log function call ---
    console.log("capturePhoto function called!");
   
    // --- END DEBUG ---

    setCameraError('');
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // --- DEBUG: Log state before checks ---
    console.log("capturePhoto checks:", { isVideoReady, detectorReady, videoExists: !!video, canvasExists: !!canvas, videoState: video?.readyState, videoW: video?.videoWidth });
    // --- END DEBUG ---

    if (!video || !canvas || !isVideoReady || video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) {
        setCameraError("Camera components not ready or video stream issue.");
        console.error("capturePhoto: Pre-capture checks failed."); // Log failure
        return;
    }
    if (!detectorReady) {
        setCameraError("Face detector is not ready.");
        console.error("capturePhoto: Detector not ready."); // Log failure
        return;
    }
    // --- ADDED SAFETY CHECK ---
        // Although the button should be disabled, double-check here
        if (numberOfFacesDetected !== 1) {
            console.error("Capture attempt failed: Expected 1 face, found", numberOfFacesDetected);
            setCameraError("Please ensure exactly one face is clearly visible before capturing.");
            return;
        }
        // --- END SAFETY CHECK ---

    console.log("capturePhoto: Getting latest detected face box...");
    const detectedPixelBox = getLatestDetectedBox();

    if (!detectedPixelBox) {
        console.error("capturePhoto: No face detected recently.");
        setCameraError("No face detected. Please ensure your face is clearly visible and centered.");
        return;
    }

    // ... (rest of the cropping and Base64 conversion logic - keep as is) ...
    const box = detectedPixelBox;
    console.log(`capturePhoto: Using face box at x:${box.x.toFixed(0)}, y:${box.y.toFixed(0)}, w:${box.width.toFixed(0)}, h:${box.height.toFixed(0)}`);
    const sx = Math.max(0, box.x);
    const sy = Math.max(0, box.y);
    const sw = Math.min(video.videoWidth - sx, box.width);
    const sh = Math.min(video.videoHeight - sy, box.height);

    if (sw <= 0 || sh <= 0) {
         console.error("capturePhoto: Invalid face dimensions after boundary check.", { sx, sy, sw, sh, vw: video.videoWidth, vh: video.videoHeight });
         setCameraError("Detected face region is invalid or too close to edge. Try repositioning.");
         return;
    }
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const context = canvas.getContext('2d');
    try {
        context.drawImage( video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height );
        console.log("capturePhoto: Cropped face drawn onto canvas.");
    } catch (drawError) {
        console.error("capturePhoto: Error drawing cropped face to canvas:", drawError);
        setCameraError("Failed to capture frame from video.");
        return;
    }
    let faceBase64 = '';
    try {
        faceBase64 = canvas.toDataURL('image/jpeg', 0.9);
        if (!faceBase64 || faceBase64 === 'data:,') { throw new Error("Generated data URL is invalid or empty."); }
        console.log("capturePhoto: Base64 data URL generated for cropped face.");
    } catch (toUrlError) {
        console.error("capturePhoto: Error converting canvas to Base64:", toUrlError);
        setCameraError("Failed to convert captured image.");
        return;
    }
    setCapturedPhoto(faceBase64);
    stopCamera();
};


// --- handleSubmit (Sends Base64 photo) ---
const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCameraError('');

    // Check if CROPPED face photo was captured
    if (!capturedPhoto) {
         setError('Please capture your face photo before submitting.');
         setCameraError('Face photo is required.');
         console.log("handleSubmit blocked: Photo not captured."); // Add log
         return;
    }
    if (nameError || emailError || phoneError) {
        setError('Please fix the errors in your details before submitting.');
        return;
    }

    // Include the Base64 photo data
    const userDetails = {
        name,
        email,
        phone,
        photoBase64: capturedPhoto // Send the Base64 string
    };

    console.log("Sending user details (including photoBase64):", { name, email, phone, photoLength: capturedPhoto.length });
    console.log("Submitting form...");

    try {
        // Ensure backend endpoint matches and expects photoBase64
        const response = await fetch('http://localhost:5000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userDetails),
        });

        const responseBody = await response.text();
        console.log("Submit Response Status:", response.status);
        // console.log("Submit Response Body:", responseBody); // Avoid logging large base64

        if (!response.ok) {
             let errorMessage = `Form submission failed (Status: ${response.status})`;
             try { errorMessage = JSON.parse(responseBody).message || errorMessage; } catch (e) { errorMessage = responseBody || errorMessage; }
             throw new Error(errorMessage);
        }
         let data;
         try { data = JSON.parse(responseBody); } catch (e) { data = { message: "Submission successful (non-JSON response)." }; }
        if (data && data.userId) {
            setUserId(data.userId);
            console.log("Submission successful, User ID:", data.userId);
            setShowInstructions(true);
        } else {
             console.error("Submission successful, but User ID not received!");
             setError("Submission succeeded, but failed to get user info.");
        }
    } catch (err) {
        console.error("Caught submission error:", err);
        setError(err.message || 'An unexpected error occurred.');
    }
};

   // Function to send proctoring log data to the backend
   const sendProctoringLog = useCallback(async (logData) => {
    if (!logData.userId) {
        console.error("Cannot send proctoring log: User ID is missing.");
        return;
    }
    // --- Remove violationCount from logData before sending ---
    const { userId, triggerEvent, startTime, endTime } = logData;
    const dataToSend = { userId, triggerEvent, startTime, endTime };
    // --- End Removal ---

    console.log("Sending proctoring log:", dataToSend); // Log the modified data
    try {
        const response = await fetch('http://localhost:5000/api/proctoring-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend), // Send the modified data
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

    // --- MODIFIED: useEffect to handle logging AND TRIGGERING WARNINGS for face detection events ---
    useEffect(() => {
        // Only run this logic during the active test phase
        if (submitted && userId && mediaStream && isCameraOn && isVideoReady) {
            const currentTime = Date.now();

            // --- Handle NO FACE Detected ---
            if (numberOfFacesDetected === 0) {
                // If this is the START of a no-face period...
                if (noFaceStartTime === null) {
                    setNoFaceStartTime(currentTime); // Start tracking duration
                    console.log("VIOLATION TRIGGER: No Face Detected");

                    // --- TRIGGER VIOLATION WARNING ---
                    setViolations(prev => prev + 1); // Increment violations
                    setWarningStartTime(currentTime); // Record start time for logging duration later
                    setCurrentWarningType('no_face'); // Set the type
                    setShowWarning(true); // Show the popup
                    // --- END TRIGGER ---

                    // If transitioning from multiple faces, reset its timer (logging happens when returning to 1)
                    if (multipleFaceStartTime !== null) {
                        setMultipleFaceStartTime(null);
                    }
                }
            }
            // --- Handle MULTIPLE FACES Detected ---
            else if (numberOfFacesDetected > 1) {
                // If this is the START of a multiple-face period...
                if (multipleFaceStartTime === null) {
                    setMultipleFaceStartTime(currentTime); // Start tracking duration
                    console.log("VIOLATION TRIGGER: Multiple Faces Detected");

                    // --- TRIGGER VIOLATION WARNING ---
                    setViolations(prev => prev + 1); // Increment violations
                    setWarningStartTime(currentTime); // Record start time for logging duration later
                    setCurrentWarningType('multiple_face'); // Set the type
                    setShowWarning(true); // Show the popup
                    // --- END TRIGGER ---

                    // If transitioning from no face, reset its timer (logging happens when returning to 1)
                    if (noFaceStartTime !== null) {
                        setNoFaceStartTime(null);
                    }
                }
            }
            // --- Handle EXACTLY ONE FACE Detected (Normal state - END of previous warning PERIOD) ---
            else if (numberOfFacesDetected === 1) {
                // If a no-face period just ENDED, log its duration and reset timer
                if (noFaceStartTime !== null) {
                    console.log("LOG EVENT DURATION END: No Face (transition to 1)");
                    // Log the duration of the no-face period
                    sendProctoringLog({
                        userId: userId,
                        triggerEvent: 'no_face', // Log the event type
                        startTime: noFaceStartTime, // When the no-face period started
                        endTime: currentTime,     // When it ended (returned to 1 face)
                    });
                    setNoFaceStartTime(null); // Reset timer
                }
                // If a multiple-face period just ENDED, log its duration and reset timer
                if (multipleFaceStartTime !== null) {
                    console.log("LOG EVENT DURATION END: Multiple Faces (transition to 1)");
                    // Log the duration of the multiple-face period
                    sendProctoringLog({
                        userId: userId,
                        triggerEvent: 'multiple_face', // Log the event type
                        startTime: multipleFaceStartTime, // When the multiple-face period started
                        endTime: currentTime,         // When it ended (returned to 1 face)
                    });
                    setMultipleFaceStartTime(null); // Reset timer
                }
            }
        } else {
            // Reset timers if test becomes inactive
            if (noFaceStartTime !== null) setNoFaceStartTime(null);
            if (multipleFaceStartTime !== null) setMultipleFaceStartTime(null);
        }

    // Dependencies: Add setters used for violation trigger
    }, [
        numberOfFacesDetected,
        submitted,
        userId,
        mediaStream,
        isCameraOn,
        isVideoReady,
        noFaceStartTime,
        multipleFaceStartTime,
        sendProctoringLog, // Ensure this is stable (useCallback)
        // Add setters needed for triggering the warning:
        setViolations,
        setWarningStartTime,
        setShowWarning,
        setCurrentWarningType
    ]);
    // --- END MODIFIED ---

     const checkFieldExists = async (field, value, setErrorCallback) => {
        // Basic client-side checks first
        if (!value) {
            setErrorCallback(`${field.charAt(0).toUpperCase() + field.slice(1)} is required.`);
            return false; // Indicate validation failed
        }
        if (field === 'email' && !validateEmail(value)) {
             setErrorCallback('Please enter a valid email address.');
             return false;
        }
         if (field === 'phone' && !validatePhone(value)) {
             setErrorCallback('Please enter a valid 10-digit phone number.');
             return false;
         }


        setErrorCallback(''); // Clear previous error before checking server

        try {
            console.log(`Checking field: ${field}, value: ${value}`);
            const response = await fetch('http://localhost:5000/api/users/check-field', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ field, value }),
            });

            const data = await response.json(); // Assume server always sends JSON

            if (!response.ok) {
                 // Handle specific statuses like 409 (Conflict) or general errors
                 if (response.status === 409) {
                     setErrorCallback(data.message || `${field} already exists.`);
                 } else {
                     setErrorCallback(data.message || `Error checking ${field}.`);
                 }
                 return false; // Indicate validation failed
            } else {
                 // Status is OK (e.g., 200)
                 console.log(`${field} is available.`);
                 setErrorCallback(''); // Explicitly clear error on success
                 return true; // Indicate validation passed
            }
        } catch (err) {
            console.error(`Error checking field ${field}:`, err);
            setErrorCallback('Network error checking field availability.');
            return false; // Indicate validation failed
        }
    };

        // Handle visibility changes
useEffect(() => {
    // Only run if the form has been submitted AND we have a userId
    if (submitted && userId) {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log("Violation detected: Tab switched");
                const currentViolationCount = violations + 1; // Calculate count before state update
                setViolations(currentViolationCount); // Increment count
                setWarningStartTime(Date.now()); // Record warning start time
                setIsScreenSharingStopped(false); // Ensure flag is correct for log type
                setShowWarning(true); // Show warning popup EVERY time
                // REMOVED: Logic to block based on count
            }
        };
 
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    // Depend on userId as well, so listener is added only when ID is available
}, [submitted, userId, violations]); // Added userId and violations to dependencies
 
 

    // Timer logic for Google Form
    useEffect(() => {
        if (submitted) {
            const interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        setIsTimeOver(true); // Mark that the timer is over
                        // setGoogleFormBlocked(true); // Show the visibility block popup
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval); // Cleanup interval on unmount
        }
    }, [submitted]);


    // Function to request screen sharing permission and capture the screen
    const requestScreenCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always', // Show the cursor in the capture
                },
                audio: false, // Disable audio capture
            });

            setMediaStream(stream); // Save the media stream for future use
            console.log('Screen sharing started successfully!');
            setShowInstructions(false); // Close the instructions popup
            setSubmitted(true); // Allow the test to start only if permission is granted
            startCamera();

            // Listen for the "Stop Sharing" event
            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.onended = () => {
                setIsScreenSharingStopped(true); // Set the flag to indicate the warning is due to screen sharing being stopped
                handleStopSharingViolation(); // Handle the violation when screen sharing is stopped
            };
        } catch (error) {
            console.error('Error requesting screen capture:', error);
            setShowPermissionError(true); // Show permission error dialog if the user denies permission
        }
    };

    const handleStopSharingViolation = () => {
        console.log("Violation detected: Screen sharing stopped");
        // --- Clear the stream immediately ---
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop()); // Ensure tracks are stopped
        }
        setMediaStream(null); // Clear the state
        // --- End Clear the stream ---
     
        const currentViolationCount = violations + 1;
        setViolations(currentViolationCount);
        setWarningStartTime(Date.now());
        setIsScreenSharingStopped(true); // Keep this flag
        setShowWarning(true);
    };

    // Function to capture a screenshot from the media stream
    const captureScreenshot = useCallback(() => {
        // --- Add checks for active stream and track ---
    if (!mediaStream || !mediaStream.active) {
        console.warn('Screenshot capture skipped: Media stream is not available or inactive.');
        return;
    }
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') {
         console.warn('Screenshot capture skipped: Video track is not available or not live.');
         return;
    }
    // --- End checks ---
 
    // Proceed with capture only if checks pass
    const imageCapture = new ImageCapture(videoTrack);

    imageCapture
        .grabFrame()
        .then((bitmap) => {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d');
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const screenshot = canvas.toDataURL('image/png');
            saveScreenshotToServer(screenshot);
            console.log('Screenshot captured successfully!');
        })
        .catch((error) => {
            // Log InvalidStateError specifically if it occurs
            if (error.name === 'InvalidStateError') {
                 console.error('Error capturing screenshot (InvalidStateError): Track state is invalid.', error);
                 // Consider stopping the interval or clearing the stream if this happens repeatedly
            } else {
                 console.error('Error capturing screenshot:', error);
            }
        });
}, [mediaStream]); // Keep mediaStream dependency
    // Function to save the screenshot to the backend
    // const saveScreenshotToServer = async (screenshot) => {
    //     try {
    //         const response = await fetch('http://localhost:5000/api/screenshots', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             body: JSON.stringify({ screenshot }),
    //         });

    //         if (!response.ok) {
    //             throw new Error('Failed to save screenshot');
    //         }

    //         console.log('Screenshot saved successfully!');
    //     } catch (error) {
    //         console.error('Error saving screenshot:', error);
    //     }
    // };
    // --- UPDATED Function to save the screenshot to the backend ---
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

    // Automatically capture a screenshot every 2 minutes
    useEffect(() => {
        if (submitted && mediaStream && userId) {
            const interval = setInterval(() => {
                console.log('Capturing screenshot...');
                captureScreenshot();
            }, 1 * 30 * 1000); // 2 minutes in milliseconds

            return () => clearInterval(interval); // Cleanup interval on unmount
        }
    }, [submitted, mediaStream, captureScreenshot,userId]);

    // Stop the media stream when the component unmounts
    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [mediaStream]);

    
    
    return (
        <div className="form-container">
     
            {/* Main Content Area: Form or Test */}
            {!submitted ? (
                // --- Details Form ---
                <form className="form-card" onSubmit={handleSubmit}>
                    <h2>Submit Your Details</h2>
                    <div className="form-group">
                        <label htmlFor="name">Name:</label>
                        <input
                            type="text"
                            id="name" // Add id
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => checkFieldExists('name', name, setNameError)} // Validate name on blur
                            required
                            aria-invalid={!!nameError}
                            aria-describedby="name-error"
                        />
                        {nameError && <p id="name-error" className={`error-message ${nameError ? 'visible' : ''}`}>{nameError || ''}</p>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email" // Add id
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => {
                                checkFieldExists('email', email, setEmailError);
                                validateEmail(email); // Validation happens in checkFieldExists now
                            }} // Validate email on blur
                            required
                            aria-invalid={!!emailError}
                            aria-describedby="email-error"
                        />
                        {emailError && <p id="email-error" className={`error-message ${emailError ? 'visible' : ''}`}>{emailError || ''}</p>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">Phone Number:</label>
                        <input
                            type="tel"
                            id="phone" // Add id
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onBlur={() => {
                                checkFieldExists('phone', phone, setPhoneError);
                                validatePhone(phone); // Validation happens in checkFieldExists now
                            }} // Validate phone on blur
                            required
                            aria-invalid={!!phoneError}
                            aria-describedby="phone-error"
                        />
                        {phoneError && <p id="phone-error" className={`error-message ${phoneError ? 'visible' : ''}`}>{phoneError || ''}</p>}
                    </div>
                    
                    {/* --- Camera & Face Detection Section --- */}
                    <div className="form-group camera-section">
                        
                        

                        {/* --- UPDATED: Show camera status/error OR preview --- */}
                        {!capturedPhoto ? (
                            // Show live feed stuff if no photo captured yet
                            <>
                                {/* Multiple faces warning */}
                                {isCameraOn && isVideoReady && numberOfFacesDetected > 1 && (
                                    <p className="error-message visible multiple-faces-warning" style={{ color: 'orange', fontWeight: 'bold' }}>
                                        Please ensure only one face is visible in the camera.
                                    </p>
                                )}
                                
                                {/* Camera Error Display */}
                                {cameraError && <p className="error-message visible">{cameraError}</p>}

                                {/* Live feed container (show if camera should be on) */}
                                {(isCameraOn || !detectorReady) && !cameraError && ( // Show container while starting or if running
                                    <div className="camera-live-container">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="camera-video-feed"
                                            style={{ visibility: isVideoReady ? 'visible' : 'hidden' }} // Hide until ready
                                        ></video>

                                        {/* Loading indicator while video not ready */}
                                        {!isVideoReady && detectorReady && <p className="camera-loading">Initializing camera...</p>}

                                        {/* Overlay (Optional) */}
                                        {faceDetectedBox && isVideoReady && numberOfFacesDetected === 1 && (
                                            <>
                                                {/* Your overlay div */}
                                            </>
                                        )}

                                        {/* Capture Button (Only button needed here) */}
                                        <div className="camera-controls">
                                            <button
                                                type="button"
                                                onClick={capturePhoto}
                                                className="camera-button capture-button"
                                                disabled={!isVideoReady || numberOfFacesDetected !== 1}
                                            >
                                                {!isVideoReady
                                                    ? 'Loading...'
                                                    : numberOfFacesDetected === 0
                                                    ? 'Align Face...'
                                                    : numberOfFacesDetected === 1
                                                    ? 'Capture Face Photo'
                                                    : 'Multiple Faces Detected'}
                                            </button>
                                            {/* REMOVED Cancel Camera button */}
                                        </div>
                                    </div>
                                )}
                                {!detectorReady && <p>Loading face detector...</p>}
                            </>
                        ) : (
                            // Show preview if photo IS captured
                            <div className="photo-preview">
                                <p>Face Photo Captured:</p>
                                <img src={capturedPhoto} alt="Your captured face" className="captured-photo-preview" />
                                {/* Button to restart the camera for retake */}
                                <button
                                    type="button"
                                    onClick={startCamera} // Re-calls startCamera to clear photo and restart feed
                                    className="camera-button retake-button"
                                    disabled={!detectorReady} // Disable if detector isn't ready
                                >
                                    {detectorReady ? 'Retake Photo' : 'Loading Detector...'}
                                </button>
                            </div>
                        )}
                        {/* --- END UPDATED --- */}

                        {/* Hidden canvas (Keep as is) */}
                        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                    </div>
                    {/* --- End Camera Section --- */}
     
                    {error && <p className="error-message visible">{error}</p>}
                    <button
                        type="submit"
                        className="submit-button"
                        disabled={!capturedPhoto || !!nameError || !!emailError || !!phoneError} // Disable if no photo or field errors
                    >
                        Submit Details
                    </button>
                </form>
            ) : (
                // --- Test Area (Submitted) ---
                isTimeOver ? (
                    // --- Time Over Popup ---
                    // This state is handled by the popup rendering below
                    null // Render nothing here, popup handles display
                ) : showScreenShareRequiredError ? (
                    // --- Persistent Screen Share Error Popup ---
                    // This state is handled by the popup rendering below
                    null // Render nothing here, popup handles display
                ) : mediaStream ? (
                    // --- Google Form Page (Screen Sharing Active) ---
                    <div className="google-form-page">
                        <div className="google-form-container" ref={googleFormRef}>
                        <div className="timer-container">
                                <p className="custom-timer">Time remaining: {Math.floor(timer / 60)}:{timer % 60}</p>
                            </div>
                            <div className="camera-feed">
                                <div className="camera-box">
                                    {cameraError && <p className="error-message camera-error">{cameraError}</p>}
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className={`camera-video ${cameraError ? 'hidden' : ''}`} // Hide video element on error
                                    ></video>
                                    {/* Optional: Show loading state while camera starts and stream is not yet ready */}
                                    {/* {isCameraOn && !streamRef.current && !cameraError && <p className="camera-loading">Starting camera...</p>} */}
                                    {!isCameraOn && !cameraError && <p className="camera-placeholder">Camera off</p>}
                                </div>
                            </div>
                            <iframe
                                // Replace with YOUR Google Form embed link
                                src="https://docs.google.com/forms/d/e/1FAIpQLSdjoWcHb2PqK1BXPp_U8Z-AYHyaimZ4Ko5-xvmNOOuQquDOTQ/viewform?embedded=true"
                                className="google-form-iframe"
                                title="Google Form Test"
                                frameBorder="0" marginHeight="0" marginWidth="0"
                            >Loading…</iframe>
                        </div>
                        <p className="violations-info">Violations: {violations}</p>
                    </div>
                ) : (
                    // --- Waiting for Screen Sharing State ---
                    <div className="loading-message">
                        <p>Waiting for screen sharing permission...</p>
                        {/* You could add a loading spinner here */}
                    </div>
                )
            )}
     
            {/* --- Popups (Rendered on top of everything else) --- */}
     
             {/* Instructions Popup */}
             {showInstructions && (
                <div className="popup-overlay">
                    <div className="popup">
                        <h2>Instructions</h2>
                        <p>Please follow these rules during the test:</p>
                        <div className="instructions-list">
                            <p>You will have <strong>10 minutes</strong> to complete the test.</p>
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
                            </ul>
                            <p>If you perform any of the above actions:</p>
                            <ul>
                                <li>You will receive a warning on the first violation.</li>
                                <li>On the second violation, you will be disqualified, and access to the test will be blocked.</li>
                            </ul>
                            <p>Click agree below to confirm that you understand these instructions.</p>
                        </div>
                        <button className="agree-button" onClick={() => {
                            requestScreenCapture();
                        }}>
                            I Agree
                        </button>
                    </div>
                </div>
            )}
     
            {/* Permission Error Dialog (Initial Denial) */}
            {showPermissionError && (
                 <div className="popup-overlay">
                     <div className="popup">
                         <h2>Permission Denied</h2>
                         <p>You have denied screen-sharing permission. You cannot start the test without sharing your screen.</p>
                         <button
                             className="close-button"
                             onClick={() => setShowPermissionError(false)} // Close the error dialog
                         >
                             Close
                         </button>
                     </div>
                 </div>
            )}
     
            {/* Violation Warning Popup */}
            {showWarning && (
                <div className="popup-overlay">
                    <div className="popup">
                        <h2>Warning</h2>
                        <p>
                            Violation #{violations}. Please do not{' '}
                            {currentWarningType === 'tab_switch' ? 'switch tabs or minimize the browser' :
                            currentWarningType === 'screenshare_stop' ? 'stop screen sharing' :
                            currentWarningType === 'no_face' ? 'leave the camera view or obscure your face' :
                            currentWarningType === 'multiple_face' ? 'allow others in the camera view' :
                            'violate the rules'}
                            {' '}again.
                        </p>
                        <button
                            className="close-button"
                            // --- MODIFIED onClick ---
                            onClick={() => {
                                const endTime = Date.now(); // Time when user acknowledges the warning
                                const startTime = warningStartTime; // Time when the violation *started*

                                 // Log ONLY non-face violation events when the popup is closed
                                 if (startTime && userId && currentWarningType) {
                                    let triggerEventToLog;
                                    let shouldLogPopupClose = false; // Flag to decide if we log here

                                    switch (currentWarningType) {
                                        case 'tab_switch':
                                            triggerEventToLog = 'tab_switch';
                                            shouldLogPopupClose = true; // Log tab switch duration on close
                                            break;
                                        case 'screenshare_stop':
                                            triggerEventToLog = 'screenshare_stop';
                                            shouldLogPopupClose = true; // Log screen share stop duration on close
                                            break;
                                        // --- REMOVED logging for face events here ---
                                        case 'no_face':
                                        case 'multiple_face':
                                            // Do NOT log 'no_face' or 'multiple_face' here.
                                            // The duration is logged in the face detection useEffect when the condition ends.
                                            console.log(`Warning popup closed for ${currentWarningType}, duration log handled elsewhere.`);
                                            shouldLogPopupClose = false;
                                            break;
                                        // --- END REMOVAL ---
                                        default:
                                            triggerEventToLog = 'unknown_warning_ack';
                                            shouldLogPopupClose = true; // Log unknown warning acknowledgements if needed
                                    }

                                    // Send the log ONLY if flagged
                                    if (shouldLogPopupClose) {
                                        sendProctoringLog({
                                            userId: userId,
                                            triggerEvent: triggerEventToLog,
                                            startTime: startTime, // When the violation started
                                            endTime: endTime,     // When the user closed the popup
                                        });
                                    }
                                } else {
                                     console.error("Could not process warning interaction: startTime, userId, or currentWarningType missing.", { startTime, userId, currentWarningType });
                                }

                                // Reset warning states
                                setShowWarning(false);
                                setWarningStartTime(null);
                                setCurrentWarningType(null); // Reset the type

                                // Keep specific logic for screen share recovery
                                if (isScreenSharingStopped) {
                                    requestScreenCapture();
                                    setIsScreenSharingStopped(false);
                                }
                            }}
                            // --- END MODIFIED onClick ---
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

     
            {/* Persistent Screen Share Required Error Popup */}
            {showScreenShareRequiredError && (
                <div className="popup-overlay">
                    {/* {console.log("RENDERING: Persistent Screen Share Error Popup")} */}
                    <div className="popup">
                        <h2>Screen Sharing Required</h2>
                        <p>Screen sharing was stopped and permission is required to continue the test. Please allow screen sharing.</p>
                        <button
                            className="agree-button"
                            onClick={requestScreenCapture}
                        >
                            Allow Screen Sharing
                        </button>
                    </div>
                </div>
            )}
     
            {/* Time Over Popup (Rendered via the main logic, but placed here for clarity) */}
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