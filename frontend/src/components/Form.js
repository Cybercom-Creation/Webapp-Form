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
    const startCamera = async () => {
        console.log("Attempting to start camera...");
        setCameraError('');
        setCapturedPhoto(null); // Clear previous photo
        setIsVideoReady(false);
        setIsCameraOn(false);

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        // Check if the detector is ready (from the hook)
        if (!detectorReady) {
            setCameraError("Face detector is not ready yet. Please wait.");
            return;
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }, // Prefer front camera
                    audio: false
                });
                console.log("Camera stream obtained:", stream);
                if (!stream.getVideoTracks().length) throw new Error("No video track available.");
                setCameraStream(stream);
                setIsCameraOn(true); // Hook will react to this
            } catch (err) {
                // ... (keep existing camera error handling) ...
                 console.error("Error accessing camera:", err);
                 let userMessage = "Could not start camera.";
                 // ... (error messages based on err.name) ...
                 setCameraError(userMessage);
                 setCameraStream(null);
                 setIsCameraOn(false);
                 setIsVideoReady(false);
            }
        } else {
            setCameraError("Your browser does not support camera access (getUserMedia).");
            setIsCameraOn(false);
            setIsVideoReady(false);
        }
    };
    const stopCamera = useCallback(() => {
        console.log("Stopping camera...");
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Track kind stopped: ${track.kind}`);
            });
        }
        // Reset states
        setCameraStream(null); // This triggers useEffect cleanup
        setIsCameraOn(false);
        setIsVideoReady(false);
        // Keep capturedPhoto for preview unless retaking
    }, [cameraStream]); // Dependency on cameraStream
 
    

    // new
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
   const sendProctoringLog = async (logData) => {
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
};

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
    const saveScreenshotToServer = async (screenshot) => {
        try {
            const response = await fetch('http://localhost:5000/api/screenshots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ screenshot }),
            });

            if (!response.ok) {
                throw new Error('Failed to save screenshot');
            }

            console.log('Screenshot saved successfully!');
        } catch (error) {
            console.error('Error saving screenshot:', error);
        }
    };

    // Automatically capture a screenshot every 2 minutes
    useEffect(() => {
        if (submitted && mediaStream) {
            const interval = setInterval(() => {
                console.log('Capturing screenshot...');
                captureScreenshot();
            }, 2 * 60 * 1000); // 2 minutes in milliseconds

            return () => clearInterval(interval); // Cleanup interval on unmount
        }
    }, [submitted, mediaStream, captureScreenshot]);

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
                        <label>Your Face Photo:</label>
                        <p className="camera-instructions">
                            Position your face clearly in the frame. We'll capture a cropped photo of your face.
                        </p>
                        {/* --- UPDATED: Conditional Warning for Multiple Faces --- */}
                        {isCameraOn && isVideoReady && numberOfFacesDetected > 1 && (
                            <p className="error-message visible multiple-faces-warning" style={{ color: 'orange', fontWeight: 'bold' }}>
                                Please ensure only one face is visible in the camera.
                            </p>
                        )}
                        {/* --- END UPDATE --- */}
                        {/* Show detection status from the hook */}
                        <p className="detection-status">Status: {detectionStatus}</p>

                        {/* Camera Error Display */}
                        {cameraError && <p className="error-message visible">{cameraError}</p>}

                        {/* Button to start camera */}
                        {!isCameraOn && !capturedPhoto && (
                            <button
                                type="button"
                                onClick={startCamera}
                                className="camera-button"
                                // Disable if detector isn't ready (from hook)
                                disabled={!detectorReady}
                            >
                                {detectorReady ? 'Start Camera' : 'Loading Detector...'}
                            </button>
                        )}

                        {/* Live feed, detection box, and capture controls */}
                        {isCameraOn && (
                        <div className="camera-live-container">
                        <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="camera-video-feed"
                        ></video>

        {/* Overlay for drawing detection box */}
        {faceDetectedBox && isVideoReady && videoRef.current && (
            <>
                {/* --- DEBUG: Log dimensions and coordinates --- */}
                {console.log("Render Overlay:", {
                    videoOffsetW: videoRef.current.offsetWidth, // Rendered width
                    videoClientW: videoRef.current.clientWidth, // Width inside padding
                    videoVideoW: videoRef.current.videoWidth,   // Intrinsic width
                    boxX: faceDetectedBox.x,
                    boxW: faceDetectedBox.width,
                    calculatedLeft: videoRef.current.offsetWidth - faceDetectedBox.x - faceDetectedBox.width
                })}
                {/* --- END DEBUG ---
                <div className="detection-box-overlay" style={{
                    position: 'absolute',
                    // --- Refined Mirroring Calculation ---
                    // Use offsetWidth for rendered width
                    left: `${videoRef.current.offsetWidth - faceDetectedBox.x - faceDetectedBox.width}px`,
                    // --- End Refined Calculation ---
                    top: `${faceDetectedBox.y}px`,
                    width: `${faceDetectedBox.width}px`,
                    height: `${faceDetectedBox.height}px`,
                    border: '3px solid limegreen',
                    boxShadow: '0 0 10px rgba(50, 205, 50, 0.7)',
                    boxSizing: 'border-box', // Ensure border is included in width/height
                    pointerEvents: 'none'
                }}></div> */}
            </>
        )}

        {/* Camera controls */}
                    <div className="camera-controls">
                        {/* ... buttons ... */}
                        {/* --- DEBUG: Log button state --- */}
                        {console.log("Render Button Check:", { isVideoReady, hasBox: !!faceDetectedBox, isDisabled: !isVideoReady || !faceDetectedBox })}
                        {/* --- END DEBUG --- */}
                        <button
                            type="button"
                            onClick={capturePhoto} // Ensure this calls the function
                            className="camera-button capture-button"
                            disabled={!isVideoReady || numberOfFacesDetected !== 1}
                        >
                            {/* Dynamically update button text */}
                            {!isVideoReady
                                            ? 'Loading Camera...'
                                            : numberOfFacesDetected === 0
                                            ? 'Align Face...'
                                            : numberOfFacesDetected === 1
                                            ? 'Capture Face Photo' // The only state where it's enabled
                                            : 'Multiple Faces Detected'}
                        </button>
                        <button type="button" onClick={stopCamera} className="camera-button cancel-button">
                            Cancel Camera
                        </button>
                        </div>
                        </div>
                        )}
                        {/* Hidden canvas for drawing the CROPPED face */}
                        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                        {/* Preview of captured CROPPED face photo */}
                        {capturedPhoto && !isCameraOn && (
                            <div className="photo-preview">
                                <p>Face Photo Captured:</p>
                                <img src={capturedPhoto} alt="Your captured face" className="captured-photo-preview" />
                                <button
                                    type="button"
                                    onClick={startCamera}
                                    className="camera-button retake-button"
                                    disabled={!detectorReady} // Use hook state
                                >
                                    {detectorReady ? 'Retake Photo' : 'Loading Detector...'}
                                </button>
                            </div>
                        )}
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
                         <p>Violation #{violations}. Please do not {isScreenSharingStopped ? 'stop screen sharing' : 'switch tabs or minimize the browser'} again.</p>
                         <button
                             className="close-button"
                             onClick={() => {
                                 const endTime = Date.now();
                                 const startTime = warningStartTime;
     
                                 if (startTime && userId) {
                                     const logData = {
                                         userId: userId,
                                         triggerEvent: isScreenSharingStopped ? 'screenshare_stop' : 'tab_switch',
                                         startTime: startTime,
                                         endTime: endTime,
                                     };
                                     sendProctoringLog(logData);
                                 } else {
                                      console.error("Could not log warning interaction: startTime or userId missing.", { startTime, userId });
                                 }
     
                                 setShowWarning(false);
                                 setWarningStartTime(null);
     
                                 // If the warning was due to screen sharing stop, attempt restart
                                 if (isScreenSharingStopped) {
                                     requestScreenCapture();
                                     setIsScreenSharingStopped(false); // Reset the flag
                                 }
                             }}
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