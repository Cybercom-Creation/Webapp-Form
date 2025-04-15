import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Form.css'; // Import the CSS file for styling

const Form = () => {
    console.log("Form component rendered or re-rendered");

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
    setCapturedPhoto(null);
    setIsVideoReady(false);
    setIsCameraOn(false); // Ensure camera is marked off initially

    // Stop any existing stream first
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null); // Clear state to trigger useEffect cleanup
    }
     if (videoRef.current) {
         videoRef.current.srcObject = null; // Explicitly clear srcObject
     }


    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true, // Keep it simple first
                audio: false
            });
            console.log("Camera stream obtained:", stream);
            if (!stream.getVideoTracks().length) {
                console.warn("No video tracks found in the stream!");
                throw new Error("No video track available.");
            }
            setCameraStream(stream); // Set state, useEffect will handle the rest
            setIsCameraOn(true); // Mark camera as 'on' (stream obtained)
        } catch (err) {
            console.error("Error accessing camera:", err);
            let userMessage = "Could not start camera.";
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                userMessage = "Camera permission denied. Please allow camera access in your browser settings and refresh.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                userMessage = "No camera found. Please ensure a camera is connected and enabled.";
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                userMessage = "Camera might be already in use by another application.";
            } else {
                 userMessage = `Could not start camera: ${err.message}`;
            }
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

        // --- useEffect Hook to handle stream assignment and video readiness ---
        useEffect(() => {
            const videoElement = videoRef.current;
            // Log the state of relevant variables when the effect runs
            console.log(
                "useEffect [cameraStream, isCameraOn] triggered. isCameraOn:", isCameraOn,
                "cameraStream:", !!cameraStream, // Log true/false for brevity
                "videoElement:", !!videoElement  // Log true/false for brevity
            );
    
            // We need the video element to be rendered (isCameraOn=true)
            // AND the stream to be ready (cameraStream is not null)
            // AND the ref to be attached (videoElement is not null)
            if (isCameraOn && cameraStream && videoElement) {
                console.log("useEffect: Conditions met. Assigning stream to video element.");
                videoElement.srcObject = cameraStream;
                setIsVideoReady(false); // Reset readiness until 'canplay' or 'loadedmetadata'
    
                const handleCanPlay = () => {
                    console.log("useEffect: 'canplay' event fired. Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);
                    // Ensure dimensions are valid before trying to play and setting ready
                    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                        const playPromise = videoElement.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => {
                                console.log("useEffect: Playback started successfully.");
                                setIsVideoReady(true); // Set ready *after* play starts
                            }).catch(playError => {
                                console.error("useEffect: Error playing video:", playError);
                                setCameraError(`Could not play video stream: ${playError.message}`);
                                setIsVideoReady(false);
                            });
                        } else {
                            console.warn("useEffect: play() did not return a promise. Assuming playback started.");
                            setIsVideoReady(true); // Tentatively set ready
                        }
                    } else {
                         console.warn("useEffect: 'canplay' fired but video dimensions are zero. Waiting for 'loadedmetadata' or subsequent events.");
                    }
                };
    
                const handleLoadedMetadata = () => {
                     console.log("useEffect: 'loadedmetadata' event fired. Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);
                     // Sometimes play() needs to be called again after metadata is loaded if autoplay failed
                     if (videoElement.paused) {
                        console.log("useEffect: Video paused on loadedmetadata, attempting play again.");
                        videoElement.play().catch(e => console.error("Error playing after loadedmetadata:", e));
                     }
                     
                }
    
                const handleError = (e) => {
                     console.error("useEffect: Video element error:", e);
                     // Provide more context if possible
                     const errorDetails = videoElement.error ? `Code: ${videoElement.error.code}, Message: ${videoElement.error.message}` : 'No details available';
                     setCameraError(`Error occurred with the video stream. ${errorDetails}`);
                     setIsVideoReady(false);
                }
    
                // Add listeners
                videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
                videoElement.addEventListener('canplay', handleCanPlay);
                videoElement.addEventListener('error', handleError);
    
                // It's generally safe to attempt play() right after setting srcObject
                // Muted videos often autoplay without issues, but catch potential errors.
                videoElement.play().catch(initialPlayError => {
                    console.warn("useEffect: Initial play() attempt failed or was interrupted. Relying on events.", initialPlayError);
                    // Don't necessarily set error here, 'canplay' or 'error' events will handle it.
                });
    
    
                // Cleanup function for THIS effect instance
                return () => {
                    console.log("useEffect cleanup: Removing event listeners for video element.");
                    videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    videoElement.removeEventListener('canplay', handleCanPlay);
                    videoElement.removeEventListener('error', handleError);
    
                     // Pause the video element when the effect cleans up (e.g., camera turned off)
                     // Avoid stopping tracks here; stopCamera should manage the MediaStream lifecycle.
                     if (videoElement) {
                        videoElement.pause();
                        
                     }
                     setIsVideoReady(false); // Ensure readiness is false on cleanup
                };
            } else {
                 console.log("useEffect: Conditions not met (isCameraOn, cameraStream, or videoElement missing).");
                 // If the video element exists but the camera should be off, ensure it's paused and clear src
                 if (videoElement && !isCameraOn) {
                     console.log("useEffect: Camera off, ensuring video is paused and src is cleared.");
                     videoElement.pause();
                     if (videoElement.srcObject) {
                        videoElement.srcObject = null;
                     }
                 }
            }
       
        }, [cameraStream, isCameraOn]); // <-- CORRECTED: Depend on stream AND isCameraOn
    


// --- Capture Photo & Save Locally ---
const capturePhoto = () => {
    setCameraError(''); // Clear previous errors
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
        console.error("capturePhoto: Video or Canvas ref is not available.");
        setCameraError("Camera components not ready.");
        return;
    }

    // Check video readiness more robustly
    if (!isVideoReady || video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
        console.error(`capturePhoto: Video not ready. isVideoReady=${isVideoReady}, readyState=${video.readyState}, width=${video.videoWidth}, height=${video.videoHeight}`);
        setCameraError("Video stream not ready or has no dimensions. Please wait or try restarting the camera.");
        return;
    }

    console.log(`capturePhoto: Capturing frame ${video.videoWidth}x${video.videoHeight}`);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    try {
        // Apply mirroring transform
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        // Draw the current video frame onto the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Reset transform to avoid affecting future draws (though usually not needed here)
        context.setTransform(1, 0, 0, 1, 0, 0);
        console.log("capturePhoto: Frame drawn onto canvas.");
    } catch (drawError) {
        console.error("capturePhoto: Error drawing video frame to canvas:", drawError);
        setCameraError("Failed to capture frame from video.");
        try { context.setTransform(1, 0, 0, 1, 0, 0); } catch(e){} // Attempt reset
        return;
    }

    let photoDataUrl = '';
    try {
         // Get the image data from the canvas as a JPEG
         photoDataUrl = canvas.toDataURL('image/jpeg', 0.9); // Use JPEG for smaller size, 0.9 quality
         if (!photoDataUrl || photoDataUrl === 'data:,') { // Check for empty data URL
             console.error("capturePhoto: Generated data URL is invalid or empty.");
             setCameraError("Failed to generate valid image data from canvas.");
             return;
         }
         console.log("capturePhoto: Data URL generated (length approx:", photoDataUrl.length, ")");
    } catch (toUrlError) {
         console.error("capturePhoto: Error converting canvas to Data URL:", toUrlError);
         setCameraError("Failed to convert captured image to data format.");
         return;
    }

    // --- Save Locally (Download) ---
    try {
        const link = document.createElement('a');
        link.href = photoDataUrl;
        // Use a more descriptive filename
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
        link.download = `user_photo_${timestamp}.jpg`;
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link); // Clean up the link
        console.log("capturePhoto: Download initiated for", link.download);

        setCapturedPhoto(photoDataUrl); // Update preview state *after* successful download attempt
        stopCamera(); // Stop camera after successful capture & save attempt

    } catch (downloadError) {
        console.error("capturePhoto: Error creating or triggering download link:", downloadError);
        // Don't set camera error here, the capture worked, just download failed.
        // Maybe add a different state/message for download issues?
        alert("Photo captured, but failed to initiate automatic download. Please check browser settings.");
        setCapturedPhoto(photoDataUrl); // Still show preview
        stopCamera(); // Still stop camera
    }
};



    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setCameraError(''); // Clear camera error on submit attempt

        // Add check for captured photo if it's required
        if (!capturedPhoto) {
             setError('Please capture your photo before submitting.');
             return;
        }

        if (nameError || emailError || phoneError) {
            setError('Please fix the errors in your details before submitting.');
            return;
        }

        const userDetails = { name, email, phone };
        // You might want to include the photo data URL here if you intend to send it
        // const userDetails = { name, email, phone, photo: capturedPhoto };

        console.log("Submitting form..."); // Add log

        try {
            const response = await fetch('http://localhost:5000/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userDetails),
            });

            const responseBody = await response.text(); // Read body once
            console.log("Submit Response Status:", response.status);
            console.log("Submit Response Body:", responseBody);


            if (!response.ok) {
                 // Try to parse JSON error message if possible
                 let errorMessage = `Form submission failed (Status: ${response.status})`;
                 try {
                     const errorData = JSON.parse(responseBody);
                     errorMessage = errorData.message || errorMessage;
                 } catch (parseError) {
                     // Use text body if not JSON
                     errorMessage = responseBody || errorMessage;
                 }
                 console.error("Submission error:", errorMessage);
                 throw new Error(errorMessage);
            }

            // Assuming success response is JSON
             let data;
             try {
                 data = JSON.parse(responseBody);
             } catch (parseError) {
                 console.warn("Response body wasn't valid JSON, but status was OK.");
                 data = { message: "Submission successful (non-JSON response)." };
             }
             // --- STORE USER ID ---
        if (data && data.userId) {
            setUserId(data.userId); // Store the received user ID
            console.log("Submission successful, User ID:", data.userId);
            setShowInstructions(true); // Show instructions popup
        } else {
             console.error("Submission successful, but User ID not received from backend!");
             // Handle this error appropriately - maybe prevent proceeding?
             setError("Submission succeeded, but failed to get required user info. Please contact support.");
        }
        // --- End Store User ID ---

            // console.log("Submission successful:", data);
            // setShowInstructions(true); // Show instructions popup after form submission
        } catch (err) {
            console.error("Caught submission error:", err);
            // Display the error from the fetch operation or the thrown error
            setError(err.message || 'An unexpected error occurred during submission.');
        }
    };

    // Function to send proctoring log data to the backend
const sendProctoringLog = async (logData) => {
    if (!logData.userId) {
        console.error("Cannot send proctoring log: User ID is missing.");
        return; // Don't send if userId isn't set
    }
    console.log("Sending proctoring log:", logData);
    try {
        const response = await fetch('http://localhost:5000/api/proctoring-logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logData),
        });

        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.message || `Failed to save proctoring log (Status: ${response.status})`);
        }

        const result = await response.json();
        console.log('Proctoring log saved successfully:', result.message);

    } catch (error) {
        console.error('Error sending proctoring log:', error);
        // Optionally notify the user or retry? For now, just log it.
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
                        setGoogleFormBlocked(true); // Show the visibility block popup
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
const attemptRestartScreenCapture = async () => {
    console.log("Attempting to restart screen capture...");
    setShowScreenShareRequiredError(false); // Hide previous error if shown

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: false,
        });

        setMediaStream(stream); // Save the new stream
        console.log('Screen sharing restarted successfully!');
        // Re-attach the onended listener for future stops
        const videoTrack = stream.getVideoTracks()[0];
        videoTrack.onended = () => {
            setIsScreenSharingStopped(true);
            handleStopSharingViolation();
        };
        // If successful, the Google Form will reappear due to conditional rendering

    } catch (error) {
        console.error('Error restarting screen capture:', error);
        if (error.name === 'NotAllowedError') {
            // User denied permission during the re-prompt
            setShowScreenShareRequiredError(true); // Show the persistent error message
        } else {
            // Handle other potential errors (though less likely here)
            setError("An unexpected error occurred while trying to restart screen sharing.");
        }
        // Keep mediaStream as null if permission denied
        setMediaStream(null);
    }
};


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
            }, 1 * 60 * 1000); // 2 minutes in milliseconds

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
                            // validateEmail(email); // Validation happens in checkFieldExists now
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
                            // validatePhone(phone); // Validation happens in checkFieldExists now
                        }} // Validate phone on blur
                        required
                        aria-invalid={!!phoneError}
                        aria-describedby="phone-error"
                    />
                    {phoneError && <p id="phone-error" className={`error-message ${phoneError ? 'visible' : ''}`}>{phoneError || ''}</p>}
                </div>
                {/* --- Camera Section --- */}
                <div className="form-group camera-section">
                    <label>Your Photo:</label>
                    <p className="camera-instructions">
                        Please capture a clear photo of yourself. It will be saved to your computer.
                    </p>

                    {/* Camera Error Display */}
                    {cameraError && <p className="error-message visible">{cameraError}</p>}

                    {/* Button to start camera (only if not on and no photo taken yet) */}
                    {!isCameraOn && !capturedPhoto && (
                        <button type="button" onClick={startCamera} className="camera-button">
                            Start Camera
                        </button>
                    )}

                    {/* Live feed and capture controls (only if camera is on) */}
                    {isCameraOn && (
                        <div className="camera-live">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline // Important for mobile
                                muted // Often required for autoplay without user gesture
                                className="camera-video-feed"
                            ></video>
                            <div className="camera-controls">
                                 <button
                                    type="button"
                                    onClick={capturePhoto}
                                    className="camera-button capture-button"
                                    disabled={!isVideoReady} // Disable button until video is ready
                                >
                                    {isVideoReady ? 'Capture & Save Photo' : 'Loading Camera...'}
                                </button>
                                <button type="button" onClick={stopCamera} className="camera-button cancel-button">
                                    Cancel Camera
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Hidden canvas for drawing */}
                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                    {/* Preview of captured photo */}
                    {capturedPhoto && !isCameraOn && ( // Show preview only if captured and camera is off
                        <div className="photo-preview">
                            <p>Photo Preview (Saved Locally):</p>
                            <img src={capturedPhoto} alt="Your captured photo" className="captured-photo-preview" />
                            <button type="button" onClick={startCamera} className="camera-button retake-button">
                                Retake Photo
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
                    <div className="timer-container">
                        Time Remaining: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
                    </div>
                    <div className="google-form-container" ref={googleFormRef}>
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
                         <p>You will have <strong>{Math.floor(timer / 60)} minutes</strong> to complete the test.</p>
                         <p>Ensure you complete the test within the time limit shown.</p>
                         <p>Screen sharing is required. Your screen will be recorded.</p>
                         <p>During the test, <strong>do not</strong> switch tabs, minimize the window, or stop screen sharing.</p>
                         <p>Every violation will be logged. Please focus on the test.</p>
                         <p>Click "I Agree" below to start screen sharing and begin the test.</p>
                     </div>
                     <button className="agree-button" onClick={requestScreenCapture}>
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
                                     violationCount: violations,
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
                                 attemptRestartScreenCapture();
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
                        onClick={attemptRestartScreenCapture}
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