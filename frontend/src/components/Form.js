import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useMediaPipeFaceDetection } from '../hooks/useMediaPipeFaceDetection'; 
import { useAudioDetection } from '../hooks/useAudioDetection'; 
import './Form.css'; 
const Form = () => {
    // --- State for User Details ---
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [collegeName, setCollegeName] = useState(''); 
    const [uniqueId, setUniqueId] = useState(null); 
    const [userId, setUserId] = useState(null); 
    const [warningStartTime, setWarningStartTime] = useState(null); 
    const [isLoading, setIsLoading] = useState(false);
    const [showEmailReminderDialog, setShowEmailReminderDialog] = useState(false); 
    const emailReminderShownRef = useRef(false); 
    const [emailId, setEmailId] = useState(null); 
    const [isTestEffectivelyOver, setIsTestEffectivelyOver] = useState(false); 
    
    // --- State for Google Form loading ---
    const [googleFormUrl, setGoogleFormUrl] = useState('');
    const [isLoadingGoogleForm, setIsLoadingGoogleForm] = useState(false);
    const [errorLoadingGoogleForm, setErrorLoadingGoogleForm] = useState('');

    const [closeBlockedMessage, setCloseBlockedMessage] = useState(''); 
    const closeBlockedTimeoutRef = useRef(null); 

    // --- State for Form Flow & Errors ---
    const [submitted, setSubmitted] = useState(false); 
    const [error, setError] = useState('');
    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    
    const [iconViolationType, setIconViolationType] = useState(null); 
    const [showScreenShareRequiredError, setShowScreenShareRequiredError] = useState(false);

    // --- State for Camera ---
    const [cameraStream, setCameraStream] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(false); 
    const [isVideoReady, setIsVideoReady] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null); 
    const isInitialCameraStopped = useRef(false); 
    const [cameraError, setCameraError] = useState(''); 

    // --- NEW: State for Initial Camera Availability Check ---
    const [isCameraAvailable, setIsCameraAvailable] = useState(null); 
    const [cameraAvailabilityError, setCameraAvailabilityError] = useState(''); 



    // --- ADDED: State for face detection event timing ---
    const [noFaceStartTime, setNoFaceStartTime] = useState(null);
    const [multipleFaceStartTime, setMultipleFaceStartTime] = useState(null);
    const [lookingAwayStartTime, setLookingAwayStartTime] = useState(null); 
    

    // --- ADDED: State to track the specific type of the current warning ---
    const [currentWarningType, setCurrentWarningType] = useState(null);
   

    // --- Configuration for Consecutive Noise Alert ---
    const REQUIRED_CONSECUTIVE_NOISE_COUNT = 4; // Trigger after 4 consecutive violations
    const NOISE_TIME_WINDOW_MS = 10000; // Within 10 seconds
    const NOISE_RESET_INACTIVITY_MS = 5000;
    

    // --- Refs to track consecutive noise ---
    const consecutiveNoiseCountRef = useRef(0);
    const firstNoiseViolationInSequenceTimestampRef = useRef(null);
    const lastNoiseViolationTimestampRef = useRef(null); 
    


    // --- State for Application Settings from Admin Panel ---
    const [applicationSettings, setApplicationSettings] = useState(null);
    const [settingsLoading, setSettingsLoading] = useState(true);

    const [isTimerPaused, setIsTimerPaused] = useState(false);

   


      // --- State for Instruction Checkboxes (Single Object) ---
      const [instructionChecks, setInstructionChecks] = useState({
        inst1: false,
        inst2: false,
        inst3: false,
        inst4: false,
        inst5: false,
        inst6: false,
        inst7: false,
        inst8: false,
        inst9: false,
        inst10: false,
        inst11: false,
        inst12: false,
    });

    // --- Use the MediaPipe Face Detection Hook ---
    const {
        detectorReady,
        detectionStatus,
        faceDetectedBox,
        getLatestDetectedBox,
        isLookingAway, 
        numberOfFacesDetected
    } = useMediaPipeFaceDetection(videoRef, isCameraOn, isVideoReady); 

    // --- State for Proctoring/Google Form ---
    const [showInstructions, setShowInstructions] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [showPermissionError, setShowPermissionError] = useState(false);
    const [timer, setTimer] = useState(null);
    const [isTimeOver, setIsTimeOver] = useState(false);
    const [isOvertimeActive, setIsOvertimeActive] = useState(false); // <<< NEW: State for overtime UI
    const googleFormRef = useRef(null);
    const [mediaStream, setMediaStream] = useState(null);
    const [isScreenSharingStopped, setIsScreenSharingStopped] = useState(false);
    const [isFaceDetectionGracePeriod, setIsFaceDetectionGracePeriod] = useState(false);
    const [audioSetupError, setAudioSetupError] = useState(null);
    const [noiseStartTime, setNoiseStartTime] = useState(null);
    // --- ADDED: Ref for the audio visualization canvas ---
    const audioCanvasRef = useRef(null);
    
    const wsRef = useRef(null);

     // --- Use the Audio Level Detection Hook ---
     
     const isTestActiveForProctoring = submitted && 
     userId && 
     !isTimeOver && 
     !isTestEffectivelyOver && 
     !settingsLoading && 
     applicationSettings;

const isAudioMonitoringActive = isTestActiveForProctoring && applicationSettings.noiseDetectionEnabled;

     const {
         isAboveThreshold: isNoiseLevelHigh, 
         currentDecibels, 
         audioError: hookAudioError, 
         isMonitoring: isAudioMonitoring, 
         waveformArray
     } = useAudioDetection(isAudioMonitoringActive);

    
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };
    const validatePhone = (phone) => {
        const phoneRegex = /^[0-9]{10}$/; 
        return phoneRegex.test(phone);
    };

    

    // --- Camera Control Functions ---
    const stopCamera = useCallback(() => {
        console.log("<<< stopCamera called >>>");
        
        setCameraStream(prevStream => {
            if (prevStream) {
                console.log(`Stopping tracks for stream ID: ${prevStream.id}`);
                prevStream.getTracks().forEach(track => {
                    track.stop();
                    console.log(`   Track kind stopped: ${track.kind}, state: ${track.readyState}`);
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = null; 
                    console.log("   Cleared video srcObject");
                }
                return null; 
            }
            console.log("   No active stream found to stop.");
            return null; 
        });
       
        setIsCameraOn(false);
        setIsVideoReady(false);
        console.log("   Camera state set to OFF and NOT READY.");
    }, []); 
    const startCamera = useCallback(async (phase = 'initial') => {

        // --- ADDED: Check if camera was found available initially ---
        if (isCameraAvailable === false) {
            console.log(`startCamera (${phase}): Aborting. Initial check found no camera available.`);
            
            if (phase === 'initial' && applicationSettings?.userPhotoFeatureEnabled) {
                 //setCameraError('Photo capture unavailable: No camera detected on your device.');
            } else if (phase === 'test' && applicationSettings?.liveVideoStreamEnabled) {
                 //setCameraError('Live video unavailable: No camera detected on your device.');
            }
            // Ensure camera state reflects it's not on
            setIsCameraOn(false);
            setIsVideoReady(false);
            return; 
        }
       




        // Check if already on/starting to prevent race conditions
        
        if (isCameraOn || cameraStream) {
            console.log(`startCamera (${phase}): Already starting/on (isCameraOn: ${isCameraOn}, stream: ${!!cameraStream}). Aborting.`);
            return;
        }
        console.log(`>>> startCamera called for phase: ${phase} >>>`);
        setCameraError('');
        setIsVideoReady(false); 

        
        if (cameraStream) {
             console.warn(`startCamera (${phase}): Found existing stream unexpectedly. Stopping it.`);
             stopCamera(); 
        }

        if (!detectorReady) {
            setCameraError("Face detector is not ready yet. Please wait.");
            console.log(`startCamera (${phase}) failed: Detector not ready.`);
            setIsCameraOn(false); 
            return;
        }

        console.log(`startCamera (${phase}): Requesting user media...`);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            console.log(`startCamera (${phase}): Camera stream obtained:`, stream.id);
            if (!stream.getVideoTracks().length) {
                 stream.getTracks().forEach(t => t.stop()); 
                 throw new Error("No video track available.");
            }
            // Set state *after* successful acquisition
            setCameraStream(stream);
            setIsCameraOn(true); 
            console.log(`startCamera (${phase}): State set to ON.`);
        } catch (err) {
            console.error(`startCamera (${phase}): Error accessing camera:`, err.name, err.message);
            let userMessage = "Could not start camera.";
            if (err.name === "NotAllowedError") userMessage = "Camera permission denied. Please allow camera access.";
            else if (err.name === "NotFoundError") userMessage = "No camera found.";
            else if (err.name === "NotReadableError") userMessage = "Camera is already in use.";
            setCameraError(userMessage);
            
            setCameraStream(null);
            setIsCameraOn(false);
            setIsVideoReady(false);
        }
    
    }, [detectorReady, stopCamera, isCameraAvailable, applicationSettings]);


    // --- Initial Camera Availability Check ---
    useEffect(() => {
        
        if (!submitted && isCameraAvailable === null) { 
            const checkCameraAvailability = async () => {
                console.log(">>> Effect (Camera Check): Running initial camera availability check...");
                if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                    console.warn("Effect (Camera Check): MediaDevices API not supported.");
                    setCameraAvailabilityError('Your browser does not support camera detection.');
                    setIsCameraAvailable(false);
                    return;
                }

                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const hasVideoInput = devices.some(device => device.kind === 'videoinput');

                    if (hasVideoInput) {
                        console.log("Effect (Camera Check): Camera detected.");
                        setIsCameraAvailable(true);
                        setCameraAvailabilityError(''); 
                    } else {
                        console.warn("Effect (Camera Check): No camera detected.");
                        setIsCameraAvailable(false);
                       
                    }
                } catch (err) {
                    console.error("Effect (Camera Check): Error enumerating devices:", err);
                    setIsCameraAvailable(false);
                    
                    setCameraAvailabilityError('Could not check for camera. Features requiring a camera may be unavailable.');
                    
                }
            };

            checkCameraAvailability();
        }
    }, [submitted, isCameraAvailable]); 

    // --- Function to Fetch Application Settings  ---
    const fetchAppSettings = useCallback(async () => {
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
    
        const getDefaultSettings = () => ({
            liveVideoStreamEnabled: false,
            noiseDetectionEnabled: false,
            userPhotoFeatureEnabled: false,
            periodicScreenshotsEnabled: false,
            screenshotIntervalSeconds: 30,
            testDurationSeconds: 600, // Default to 10 minutes (600 seconds)
            testDurationInterval: 10, // Default 10 minutes
        });
    
        console.log("Attempting to fetch application settings...");
        setSettingsLoading(true);
        try {
            const response = await fetch(`${apiBaseUrl}/api/settings`);
            console.log('API Response Status:', response.status);
            if (!response.ok) {
                console.error(`Error fetching settings: ${response.status} ${response.statusText}`);
                const errorBody = await response.text();
                console.error('Error response body:', errorBody);
                setApplicationSettings(getDefaultSettings());
                return;
            }
            const settings = await response.json();
            console.log('Fetched application settings:', settings);
            setApplicationSettings(settings);
        } catch (error) {
            console.error('Failed to fetch application settings:', error);
            setApplicationSettings(getDefaultSettings());
        } finally {
            setSettingsLoading(false);
        }
    }, []); 
    
    // --- Effect: Initial Fetch of Application Settings ---
    useEffect(() => {
        fetchAppSettings();
    }, [fetchAppSettings]); // Call on mount
    
    // --- Effect: Parse College Name from URL ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const encodedCollegeName = params.get('college');

        if (encodedCollegeName) {
            try {
                const decodedName = atob(encodedCollegeName); // Decode Base64
                setCollegeName(decodedName);
                console.log('Decoded college name from URL:', decodedName);
            } catch (e) {
                console.error('Failed to decode college name from URL parameter:', e);
                
            }
        }
    }, []); 

    // --- Effect: WebSocket Connection Management ---
    useEffect(() => {
        // Only establish WebSocket connection if we have a userId AND haven't connected yet
        if (!emailId || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
            if (!emailId && !wsRef.current) { // Log only if truly not connecting
                console.log('WebSocket: emailId not available yet, skipping connection.');
            } else {
                console.log('WebSocket: Connection already open and healthy.');
            }
            return;
        }

        
        if (wsRef.current) {
            console.log('WebSocket: Stale connection found, closing it before reconnecting.');
            wsRef.current.close();
            wsRef.current = null;
        }

        // Proceed to establish a new connection
        if (emailId) {
            
            const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000'; 
            console.log(`Attempting to connect WebSocket to: ${wsUrl}`);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws; // Store the instance

            ws.onopen = () => {
                console.log('WebSocket connection opened');
                // Send identification message to the backend
                ws.send(JSON.stringify({ type: 'IDENTIFY', email: emailId }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);

                    

                    if (data.type === 'FORM_SUBMITTED_CONFIRMED') {
                        console.log(`FORM_SUBMITTED_CONFIRMED received. Comparing server email ('${data.email}') with local emailId ('${emailId}').`);
                        if (data.email === emailId) {
                            console.log('Email match! Form submission confirmed for this user. Setting isTestEffectivelyOver to true.');
                            
                            setIsTestEffectivelyOver(true); // This will trigger the "Test Session Concluded" view and cleanup.
                        } else {
                            console.warn('FORM_SUBMITTED_CONFIRMED received, but data.email does not match local emailId. Ignoring notification for this client.');
                        }
                    } else if (data.type === 'IDENTIFIED') {
                        console.log('WebSocket connection successfully identified by server.');
                    }
                    // Handle other message types if needed
                } catch (error) {
                    console.error('Failed to parse WebSocket message from server:', event.data, error);
                }
            };

            ws.onclose = (event) => {
                console.log(`WebSocket connection closed: Code=${event.code}, Reason=${event.reason}`);
                wsRef.current = null; 
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                wsRef.current = null;
            };
        }

        
        return () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log('Closing WebSocket connection due to component unmount or userId change.');
                wsRef.current.close();
            }
            wsRef.current = null; 
        };
    }, [emailId, fetchAppSettings]); 

    // --- Effect: Fetch Google Form Link when test is ready to start ---
    useEffect(() => {
        
        if (submitted && !isTestEffectivelyOver && applicationSettings && !googleFormUrl && !isLoadingGoogleForm) {
            const fetchGoogleFormLink = async () => {
                console.log("Attempting to fetch Google Form link...");
                setIsLoadingGoogleForm(true);
                setErrorLoadingGoogleForm('');
                try {
                    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
                    const response = await fetch(`${apiBaseUrl}/api/settings/google-form-link`);

                    if (!response.ok) {
                        let errorMsg = `Failed to load exam configuration (Status: ${response.status})`;
                        try {
                            
                            const errorData = await response.json();
                            errorMsg = errorData.message || errorMsg;
                        } catch (e) {
                           
                            errorMsg = response.statusText || errorMsg;
                            console.warn("Response for google-form-link was not JSON, status:", response.status);
                        }
                        throw new Error(errorMsg);
                    }

                    const data = await response.json();
                    if (data.success && data.link && data.link.trim() !== '') {
                        setGoogleFormUrl(data.link);
                        console.log("Google Form link fetched successfully:", data.link);
                    } else {
                        const msg = data.message || 'The exam form is currently unavailable or not configured. Please contact support.';
                        setErrorLoadingGoogleForm(msg);
                        console.error(msg);
                    }
                } catch (error) {
                    console.error('Error fetching Google Form link:', error);
                    setErrorLoadingGoogleForm(`An error occurred while loading the exam: ${error.message}`);
                } finally {
                    setIsLoadingGoogleForm(false);
                }
            };

            fetchGoogleFormLink();
        }
    }, [submitted, isTestEffectivelyOver, applicationSettings, googleFormUrl, isLoadingGoogleForm]);

    // --- Effect 1: Initial Camera Start ---
    
    useEffect(() => {
        
        console.log(`Effect 1 (Initial Start Check): submitted=${submitted}, detectorReady=${detectorReady}, isCameraOn=${isCameraOn}, settingsLoading=${settingsLoading}, userPhotoEnabled=${applicationSettings?.userPhotoFeatureEnabled}`);

        if (settingsLoading || !applicationSettings) {
            console.log("Effect 1: Settings not loaded yet. Skipping initial camera start.");
            return;
        }

        
        if (!submitted && detectorReady && !isCameraOn && applicationSettings.userPhotoFeatureEnabled && isCameraAvailable === true) {
            console.log(">>> Effect 1: Conditions met (userPhotoFeatureEnabled, camera available). Calling startCamera('initial').");
            startCamera('initial'); // Pass phase for logging
        }
        else if (!submitted && applicationSettings.userPhotoFeatureEnabled && isCameraAvailable === false) {
            console.log(">>> Effect 1: User photo feature enabled, but camera NOT available. Initial camera will not be started. cameraAvailabilityError should be displayed.");
        } 
        else if (!submitted && detectorReady && !isCameraOn && !applicationSettings.userPhotoFeatureEnabled) {
            console.log(">>> Effect 1: User photo feature disabled by settings. Initial camera will not be started.");
        }
        
    }, [submitted, detectorReady, isCameraOn, startCamera, applicationSettings, settingsLoading, isCameraAvailable]); 


    // --- Effect 2: Stop Initial Camera on Submission or Unmount ---
    
    useEffect(() => {
        
        return () => {
            
            console.log(`<<< Effect 2 (Stop on Submit/Unmount) Cleanup running. Current submitted state: ${submitted}, isInitialCameraStopped: ${isInitialCameraStopped.current}`);

           
            if (isCameraOn && !isInitialCameraStopped.current) {
                 console.log("<<< Effect 2 Cleanup: Camera is ON and initial stop not triggered yet. Calling stopCamera.");
                 stopCamera();
                
            } else {
                 console.log(`<<< Effect 2 Cleanup: Conditions NOT met (isCameraOn: ${isCameraOn}, initialStopTriggered: ${isInitialCameraStopped.current}). No stop action needed.`);
            }
        };
    
    }, [submitted, isCameraOn, stopCamera]);


    // --- Function to call backend to mark test start ---
    const markTestStart = useCallback(async () => {
        if (!userId) {
            console.error("Cannot mark test start: userId is missing.");
            return;
        }
        try {
            console.log(`Calling backend to mark test start for user: ${userId}`);
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/users/${userId}/start-test`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                // No body needed for this simple trigger
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to mark test start (Status: ${response.status})`);
            }
            const result = await response.json();
            console.log('Backend confirmed test start:', result.message);
        } catch (error) {
            console.error('Error calling markTestStart endpoint:', error);
            
        }
    }, [userId]); 

    // --- Function to call backend to mark test end ---
    const markTestEnd = useCallback(async () => {
        if (!userId) {
            console.error("Cannot mark test end: userId is missing.");
            return;
        }
        try {
            console.log(`Calling backend to mark test end for user: ${userId}`);
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/users/${userId}/end-test`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
            });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to mark test end (Status: ${response.status})`);
            }
            const result = await response.json();
            console.log('Backend confirmed test end:', result.message);
        } catch (error) {
            console.error('Error calling markTestEnd endpoint:', error);
        }
    }, [userId]);


    // --- Effect: Handle Test Completion due to Form Submission ---
    useEffect(() => {
        if (isTestEffectivelyOver) {
            console.log("Test is effectively over due to form submission confirmation. Cleaning up active proctoring...");

            // Stop camera if it's on
            if (isCameraOn) {
                stopCamera();
            }
            // Stop screen sharing stream if it exists
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
                setMediaStream(null); // Clear the stream state
            }

            // Mark test end if it hasn't been marked by time running out
            // This ensures the backend knows the test concluded.
            if (!isTimeOver) {
                markTestEnd(); // This will also set isTimeOver if not already set by timer
            }
        }
    }, [isTestEffectivelyOver, isCameraOn, stopCamera, mediaStream, setMediaStream, isTimeOver, markTestEnd]);


     // --- Effect: Show Email Reminder Dialog on Test Start ---
     useEffect(() => {
        // Check if the test area is active AND the dialog hasn't been shown yet for this session
        if (submitted && mediaStream && !emailReminderShownRef.current) {
            setShowEmailReminderDialog(true); // Show the dialog
            emailReminderShownRef.current = true; // Mark that it has been shown
        }

        // Optional: Reset the ref if the test area becomes inactive
        if (!submitted || !mediaStream) {
            emailReminderShownRef.current = false;
        }

    }, [submitted, mediaStream]); 
    

    // --- Effect 3: Stream Assignment and Video Readiness ---
    useEffect(() => {
        const videoElement = videoRef.current;
        let isActive = true; 

        if (isCameraOn && cameraStream && videoElement) {
            console.log(`Effect 3 [stream]: Assigning stream ${cameraStream.id} and setting up listeners.`);
            videoElement.srcObject = cameraStream;

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
                   if (isVideoReady) setIsVideoReady(false);
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
                if (isVideoReady) setIsVideoReady(false);
            };

            videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoElement.addEventListener('canplay', handleCanPlay);
            videoElement.addEventListener('error', handleError);

            
            console.log("Effect 3 [stream]: Attempting initial play...");
            videoElement.play().catch(e => {
                
                if (isActive) console.warn(`Effect 3 [stream]: Initial play() failed (may be interrupted, waiting for events): ${e.name}`);
            });

            return () => {
                isActive = false;
                console.log(`Effect 3 [stream]: Cleanup for stream ${cameraStream?.id}`);
                videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
                videoElement.removeEventListener('canplay', handleCanPlay);
                videoElement.removeEventListener('error', handleError);
               
                if (videoElement && !videoElement.paused) {
                    videoElement.pause();
                    console.log("Effect 3 [stream]: Paused video.");
                }
                
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
    
    }, [cameraStream, isCameraOn]); 


    // --- Function to Capture Current Face Frame ---
    
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


    // --- handleSubmit ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const isNameValid = await checkFieldExists('name', name, setNameError);
        const isEmailValid = await checkFieldExists('email', email, setEmailError);
        const isPhoneValid = await checkFieldExists('phone', phone, setPhoneError);


        // 1. Validate form fields
        if (!isNameValid || !isEmailValid || !isPhoneValid ) {
           
            return;
        }

        
        let capturedPhotoBase64 = null;

        if (applicationSettings && applicationSettings.userPhotoFeatureEnabled) {
            
            if (isCameraAvailable === true) { // Only attempt capture if camera is available
                // 2. Check camera/face state if photo capture is enabled AND camera available
                if (!isCameraOn || !isVideoReady) {
                    setError('Camera is not ready for photo capture. Please wait or check permissions.');
                    
                    return;
                }
                if (numberOfFacesDetected !== 1) {
                    setError('Please ensure exactly one face is clearly visible for the photo.');
                    
                    return;
                }
                if (isLookingAway) {
                    setError('Please look straight into the screen for the photo.');
                    
                    return;
                }

                // 3. Capture the face photo NOW
                console.log("handleSubmit: User photo feature enabled and camera available. Attempting to capture face photo...");
                const captureResult = captureCurrentFaceBase64();

                if (captureResult.error || !captureResult.photoBase64) {
                    setError(`Failed to capture face photo: ${captureResult.error || 'Unknown reason'}`);
                    console.error("handleSubmit blocked: Photo capture failed.", captureResult.error);
                    
                    return;
                }
                capturedPhotoBase64 = captureResult.photoBase64;
                console.log("handleSubmit: Face photo captured successfully.");
            } else if (isCameraAvailable === false) {
                console.log("handleSubmit: User photo feature enabled, but no camera is available. Proceeding with submission, photo will be skipped.");
                
            } else { 
                
                setError('Camera availability is still being checked. Please wait.');
                
                return;
            }
        } else {
            console.log("handleSubmit: User photo feature is DISABLED by settings. Skipping photo capture.");
        }
        //Proceed with submission
        setIsLoading(true);

        // 4. Prepare data and submit
       
        const userDetails = { name, email, phone, collegeName }; 
        
        let logMessage = "Submitting user details...";

        // Add photo only if feature enabled, camera was available, AND photo was successfully captured.
        if (applicationSettings?.userPhotoFeatureEnabled && isCameraAvailable === true && capturedPhotoBase64) {
            userDetails.photoBase64 = capturedPhotoBase64;
            logMessage = "Submitting user details with captured photo...";
        }
        else if (applicationSettings?.userPhotoFeatureEnabled && isCameraAvailable === false) {
            logMessage = "Submitting user details (user photo feature enabled, but no camera; photo skipped)...";
        } else if (!applicationSettings?.userPhotoFeatureEnabled) {
            logMessage = "Submitting user details (user photo feature disabled)...";
        }
        console.log(logMessage, userDetails);

        

        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userDetails),
            });

            const responseBodyText = await response.text();
            console.log("Submit Response Status:", response.status);

            if (!response.ok) {
                
            let backendErrorMessage = `Form submission failed (Status: ${response.status})`;
                try {
                    const parsedBody = JSON.parse(responseBodyText);
                    backendErrorMessage = parsedBody.message || backendErrorMessage;
                } catch (parseErr) {
                    backendErrorMessage = responseBodyText || backendErrorMessage; // Use raw text if not JSON
                }

                const isPhoneExistenceError = backendErrorMessage.toLowerCase().includes('phone') &&
                                             (backendErrorMessage.toLowerCase().includes('exist') || backendErrorMessage.toLowerCase().includes('already taken'));

                if (isPhoneExistenceError) {
                    setPhoneError(backendErrorMessage); 
                } else {
                    setError(backendErrorMessage); 
                }
               
                return; // Stop further processing in the try block    
            }

            // --- Success ---
            let data;
            
            try { data = JSON.parse(responseBodyText); } catch (parseErr) { data = { message: "Submission successful (non-JSON response)." }; }

            if (data && data.userId) {
                setUserId(data.userId);
                setEmailId(userDetails.email);
                console.log("Submission successful, User ID:", data.userId);
                console.log("Submission successful, email ID:", userDetails.email);
                
                isInitialCameraStopped.current = true; 
                console.log("handleSubmit success: Marked initial camera stop flag.");
                
                setShowInstructions(true); 
            } else {
                
            console.error("Network or unexpected error during submission:", error);
            setError(error.message || 'An unexpected network error occurred.');
            }
        } catch (error) {
            console.error("Caught submission error:", error);
            setError(error.message || 'An unexpected error occurred during submission.');
        }
        finally{
            setIsLoading(false); 
        }
    };

    // --- Proctoring Log Function  ---
    const sendProctoringLog = useCallback(async (logData) => {
        if (!logData.userId) {
            console.error("Cannot send proctoring log: User ID is missing.");
            return;
        }
        const { userId, triggerEvent, startTime, endTime } = logData;
        const dataToSend = { userId, triggerEvent, startTime, endTime };

        console.log("Sending proctoring log:", dataToSend);
        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/proctoring-logs`, {
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

    
    // --- Face Detection Logging/Warning Trigger (REFINED LOGIC) ---
    useEffect(() => {
        const currentTime = Date.now(); // Moved up
       
        const isActiveTestPhaseForFaceDetection = 
        isTestActiveForProctoring && 
        applicationSettings.liveVideoStreamEnabled && 
        isCameraOn && 
        isVideoReady && 
        !isFaceDetectionGracePeriod; 
        
 
        // --- Handle Active Test Phase ---
        if (isActiveTestPhaseForFaceDetection) { 
            
            let newFaceIconType = null; 
            let faceViolationActive = false;
 
            // --- Determine current face violation state ---
            if (numberOfFacesDetected === 0) {
                faceViolationActive = true;
                
                newFaceIconType = 'no_face';
                if (noFaceStartTime === null) {
                    setNoFaceStartTime(currentTime); 
                    console.log("VIOLATION TRIGGER: No Face Detected - Timer Started");
                }
                // Clear the other face timer if it was running
                if (multipleFaceStartTime !== null) {
                    console.log("LOG EVENT DURATION END: Multiple Faces (transition to 0)");
                    sendProctoringLog({ userId: userId, triggerEvent: 'multiple_face', startTime: multipleFaceStartTime, endTime: currentTime });
                    setMultipleFaceStartTime(null);
                }
                if (lookingAwayStartTime !== null) { // <-- Clear looking away timer
                    console.log("LOG EVENT DURATION END: Looking Away (transition to 0)");
                    sendProctoringLog({ userId: userId, triggerEvent: 'looking_away', startTime: lookingAwayStartTime, endTime: currentTime });
                    setLookingAwayStartTime(null);
                }
            } else if (numberOfFacesDetected > 1) {
                faceViolationActive = true;
                
                newFaceIconType = 'multiple_face';
                if (multipleFaceStartTime === null) {
                    setMultipleFaceStartTime(currentTime); // Start timer
                    console.log("VIOLATION TRIGGER: Multiple Faces Detected - Timer Started");
                }
                // Clear the other face timer if it was running
                if (noFaceStartTime !== null) {
                    console.log("LOG EVENT DURATION END: No Face (transition to >1)");
                    sendProctoringLog({ userId: userId, triggerEvent: 'no_face', startTime: noFaceStartTime, endTime: currentTime });
                    setNoFaceStartTime(null);
                }
                if (lookingAwayStartTime !== null) { // <-- Clear looking away timer
                    console.log("LOG EVENT DURATION END: Looking Away (transition to >1)");
                    sendProctoringLog({ userId: userId, triggerEvent: 'looking_away', startTime: lookingAwayStartTime, endTime: currentTime });
                    setLookingAwayStartTime(null);
                }
            
            } else { // numberOfFacesDetected === 1 AND not looking away (Normal)
                // Log end duration for any *previously* active face violation
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
               
                if (iconViolationType === 'no_face' || iconViolationType === 'multiple_face' || iconViolationType === 'looking_away') {
                    setIconViolationType(null);
                    // currentWarningType should be null if it was for an icon, or related to tab_switch/incorrect_screen_share
                }
            }
            // --- Update General Warning State ---
            // if (faceViolationActive) {
            //     if (!showWarning || (currentWarningType !== newWarningType)) { // Show if not shown, or if type changes
            //         console.log(`Setting/Updating general warning for face violation: ${newWarningType}`);
            //         setWarningStartTime(currentTime); // Set/Update general warning start time
            //         setCurrentWarningType(newWarningType);
            //         setShowWarning(true);
            //     }
            //     // If the warning *is* already shown for the *correct* face violation type, do nothing to avoid loops.
            //     else if (showWarning && currentWarningType === newWarningType) {
            //          console.log(`Face violation (${newWarningType}) continues, warning already shown.`);
            if (newFaceIconType) {
                if (iconViolationType !== newFaceIconType) {
                    setIconViolationType(newFaceIconType);
                    setShowWarning(false); // Ensure popup is not shown for face violations
                    setCurrentWarningType(null); // Ensure popup doesn't show stale message
                    // The specific start times (noFaceStartTime, etc.) are used for logging duration.
                    // General warningStartTime is not needed here if specific timers are used.
                }
            } else { // Face condition is normal (1 face)
                // // If the warning *was* for a face violation that is now resolved, hide it.
                // if (showWarning && (currentWarningType === 'no_face' || currentWarningType === 'multiple_face' )) {
                //     console.log(`Face condition corrected (${currentWarningType} resolved), hiding face-related warning.`);
                //     setShowWarning(false);
                //     // Reset general warning state *only when hiding due to correction*
                //     // The close handler won't run if it auto-hides.
                //     setWarningStartTime(null);
                //     setCurrentWarningType(null);
                // }
            }
 
        }
        // --- Handle Inactive Test Phase or Prerequisites Not Met ---
        else {
            // Log and clear any active face violation timers if they haven't been cleared yet
            if (noFaceStartTime !== null) {
                console.log("LOG EVENT DURATION END: No Face (test inactive/prereq failed)");
                // Avoid sending log if userId is missing (might happen during cleanup)
                if (userId) sendProctoringLog({ userId: userId, triggerEvent: 'no_face', startTime: noFaceStartTime, endTime: currentTime });
                setNoFaceStartTime(null);
            }
            if (multipleFaceStartTime !== null) {
                console.log("LOG EVENT DURATION END: Multiple Faces (test inactive/prereq failed)");
                 if (userId) sendProctoringLog({ userId: userId, triggerEvent: 'multiple_face', startTime: multipleFaceStartTime, endTime: currentTime });
                setMultipleFaceStartTime(null);
            }
            // if (lookingAwayStartTime !== null) { // <-- REMOVING: Clear looking away timer
            //     console.log("LOG EVENT DURATION END: Looking Away (test inactive/prereq failed)");
            //     if (userId) sendProctoringLog({ userId: userId, triggerEvent: 'looking_away', startTime: lookingAwayStartTime, endTime: currentTime });
            //     setLookingAwayStartTime(null);
            // }
            // Clear icon if test is not active
            if (iconViolationType === 'no_face' || iconViolationType === 'multiple_face' || iconViolationType === 'looking_away') {
                setIconViolationType(null);
            }
        }
 
    }, [
        // Core dependencies that trigger re-evaluation
        numberOfFacesDetected,
        submitted,
        userId,
        mediaStream,
        isCameraOn,
        isVideoReady,
        isTimeOver,
        isFaceDetectionGracePeriod,
        // Include state values read *within* the effect but which shouldn't trigger re-run on their own change
        // (React handles this, but explicit inclusion can clarify intent)
        noFaceStartTime,
        multipleFaceStartTime,
        // lookingAwayStartTime, // <-- REMOVING
        isLookingAway, // <-- Include pose status
        showWarning, // Needed to decide *if* we need to update/hide
        currentWarningType, // Needed to decide *if* we need to update/hide
        // Include functions/setters called
        sendProctoringLog,
        isTestEffectivelyOver, // Added dependency
        //setNoFaceStartTime,
        // isTestActiveForProctoring, // Added
        // applicationSettings, // Added
        setMultipleFaceStartTime,
        setWarningStartTime, setShowWarning, setCurrentWarningType
        // setLookingAwayStartTime, // <-- REMOVING
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
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/users/check-field`, {
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
        } catch (error) {
            console.error(`Error checking field ${field}:`, error);
            setErrorCallback('Network error checking field availability.');
            return false;
        }
    };


    // --- Visibility Change Listener (Unchanged Logic) ---
    // ... (No changes needed here)
    useEffect(() => {
         // if (submitted && userId && mediaStream && !isTimeOver && !isTestEffectivelyOver) { // Added !isTestEffectivelyOver
            if(isTestActiveForProctoring){
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    console.log("Violation detected: Tab switched");
                    setWarningStartTime(Date.now());
                    setIconViolationType(null); // Ensure icon is hidden when overlay is shown
                    setCurrentWarningType('tab_switch'); // Set type for warning message
                    setIsScreenSharingStopped(false); // Ensure this is false for tab switch
                    setShowWarning(true);
                }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    //}, [submitted, userId, mediaStream, isTimeOver, isTestEffectivelyOver]); // Added isTestEffectivelyOver
}, [isTestActiveForProctoring]);

    // --- NEW: Effect to handle page unload during active test ---
    useEffect(() => {
        // Define the handler function
        const handleBeforeUnload = (event) => {
            // Check *inside* the handler if the test is still active
            // Use refs or state values that are guaranteed to be current if possible,
            // but state within the closure should be okay here due to dependency array.
            if (submitted && userId && !isTimeOver && !isTestEffectivelyOver) { // Added !isTestEffectivelyOver
                console.log(">>> beforeunload triggered during active test. Sending beacon to mark end time.");

                // Construct the URL for the NEW POST endpoint
                const beaconURL = `${process.env.REACT_APP_API_BASE_URL}/api/users/${userId}/beacon-end-test`;

                // sendBeacon requires data. Send an empty Blob as the body.
                const data = new Blob([''], { type: 'application/json' });

                // Attempt to send the beacon
                const success = navigator.sendBeacon(beaconURL, data);

                if (success) {
                    console.log("Beacon queued successfully to mark end time.");
                } else {
                    console.error("Failed to queue beacon to mark end time. Test duration might not be saved.");
                    // No reliable fallback here during unload.
                }

                // Don't set event.returnValue - it's deprecated and unreliable for preventing closure.
                // Let the browser handle the closing/navigation.
            } else {
                console.log(">>> beforeunload triggered, but test is not active. No action needed.");
            }
        };

        // Add the listener only when the test is active
        if (submitted && userId && !isTimeOver && !isTestEffectivelyOver) { // Added !isTestEffectivelyOver
            window.addEventListener('beforeunload', handleBeforeUnload);
            console.log("<<< beforeunload listener added for active test >>>");
            setIconViolationType(null); // Ensure icon is hidden if user tries to leave
            // Return a cleanup function to remove the listener
            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
                console.log("<<< beforeunload listener removed >>>");
            };
        }
        // Ensure the effect re-runs if the test status changes
    }, [submitted, userId, isTimeOver, isTestEffectivelyOver]); // Added isTestEffectivelyOver
    // --- End NEW Effect ---



    // --- Timer Logic (Unchanged) ---
    useEffect(() => {
        let intervalId = null;
        // Timer should start only AFTER instructions are agreed and test begins
        // if (submitted && mediaStream && !isTimeOver && !isTestEffectivelyOver) { // Added !isTimeOver and !isTestEffectivelyOver
        // if (submitted && mediaStream && !isTimeOver && !isTestEffectivelyOver && timer !== null && timer > 0 && !isTimerPaused) {
            let canTimerRun = submitted &&
            !isTimeOver &&
            !isTestEffectivelyOver &&
            timer !== null &&
            timer > 0 &&
            !isTimerPaused;

        if (applicationSettings) {
        if (applicationSettings.periodicScreenshotsEnabled) {
        // If screenshots are enabled, mediaStream (screen share) is required for the timer to run
        canTimerRun = canTimerRun && !!mediaStream;
        }
        // If screenshots are disabled, mediaStream is NOT required for the timer.
        } else {
        canTimerRun = false; // Don't run timer if settings aren't loaded
        }
        if(canTimerRun) {
            console.log(`Timer Effect: Starting/Resuming interval. Current timer: ${timer}, Paused: ${isTimerPaused}`);
            intervalId = setInterval(() => { // Store intervalId
                setTimer((prev) => {
                    if (prev <= 1) {
                        // setIsTimeOver(true);
                        // // clearInterval(intervalId); // Clear here if setIsTimeOver doesn't trigger cleanup immediately
                        // // Optionally stop camera/screen share here if time runs out
                        // //if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
                        // if (mediaStream && typeof mediaStream.getTracks === 'function') {
                        //     mediaStream.getTracks().forEach(track => track.stop());
                        // }
                        // stopCamera(); // Stop webcam too
                        // markTestEnd();
                        setIsTimeOver(true);         // Mark that allotted time is over
                        setIsOvertimeActive(true);   // Activate overtime UI
                        //markTestEnd();   
                        setIsTimerPaused(false); // Ensure unpaused if time runs out
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        else {
            // This block executes if conditions are not met (e.g., timer paused, time over, etc.)
            // If an interval was running, it should be cleared by the cleanup.
            // console.log(`Timer Effect: Conditions not met or timer paused. Interval not started/cleared. Timer: ${timer}, Paused: ${isTimerPaused}, Submitted: ${submitted}, MediaStream: ${!!mediaStream}`);
        }
        return () => {
            if (intervalId) { // Check if intervalId was set
                clearInterval(intervalId);

            }
        };
    }, [submitted, mediaStream, isTimeOver, isTestEffectivelyOver, timer, stopCamera, markTestEnd, isTimerPaused, applicationSettings]); // Added isTimeOver, isTestEffectivelyOver

    // --- Handler for "I Agree" button on instructions popup ---
    const handleAgreeAndStartTest = async () => {
        setShowInstructions(false); // Close instructions popup first

        if (settingsLoading || !applicationSettings) {
            setError("Application settings are still loading. Please wait a moment and try again.");
            return;
        }

        if (applicationSettings.periodicScreenshotsEnabled) {
            // Proceed with screen capture as before
            await requestScreenCapture();
        } else {
            // Screenshots are disabled, skip screen capture, directly start test
            console.log("Periodic screenshots disabled. Skipping screen capture, starting test directly.");

            // Stop initial camera if it was on for user photo
            if (applicationSettings.userPhotoFeatureEnabled && isCameraOn) {
                console.log('handleAgreeAndStartTest: Stopping initial camera (user photo was enabled, screenshots off)...');
                stopCamera();
                isInitialCameraStopped.current = true;
            }

            // Set up timer
            let durationInSeconds = 600; // Default
            if (applicationSettings.testDurationInterval && Number(applicationSettings.testDurationInterval) > 0) {
                durationInSeconds = Number(applicationSettings.testDurationInterval) * 60;
            } else if (applicationSettings.testDurationSeconds && Number(applicationSettings.testDurationSeconds) > 0) {
                durationInSeconds = Number(applicationSettings.testDurationSeconds);
            }
            setTimer(durationInSeconds);
            console.log(`Timer initialized to ${durationInSeconds} seconds (screenshots disabled).`);
            markTestStart();

            // Start test camera if live video is enabled
            if (applicationSettings.liveVideoStreamEnabled) {
                // console.log('handleAgreeAndStartTest: Live video enabled. Starting test camera...');
                // await startCamera('test'); // Wait for startCamera to attempt acquisition
                 console.log('handleAgreeAndStartTest: Live video enabled. Scheduling start of test camera...');
                // Introduce a brief delay to allow stopCamera's state updates to propagate
                // before startCamera is called. This mimics the behavior in requestScreenCapture
                // and helps prevent a race condition where startCamera might see stale state.
                setTimeout(async () => {
                    console.log('handleAgreeAndStartTest (deferred): Attempting startCamera("test")...');
                    await startCamera('test');
                }, 0); // Yield to the event loop.
            
            } else {
                console.log('handleAgreeAndStartTest: Live video disabled. Test camera will not be started.');
                if (isCameraOn) stopCamera(); // Ensure camera is off
            }

            setSubmitted(true);
            setIsFaceDetectionGracePeriod(true); // If face detection is still used for live video
            setIsTimerPaused(false);
            // mediaStream will be null, which is handled by the timer's useEffect and screenshot logic
        }
    };

    // --- Screen Capture Request (Modified to manage camera stop/start) ---
    const requestScreenCapture = async () => {
        setShowInstructions(false); // Close instructions popup first

        if (settingsLoading || !applicationSettings) {
            console.warn("requestScreenCapture: Settings not loaded or still loading. Aborting.");
            // Optionally, show a message to the user in the main error display
            setError("Application settings are still loading. Please wait a moment and try again.");
            return;
        }

        // If we are resuming from a paused state, don't reset the timer.
        const isResumingAfterPause = isTimerPaused; // Capture current paused state

        // isInitialCameraStopped.current = false; // Reset flag before attempting screen share

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false,
            });

            setMediaStream(stream);
            console.log('Screen sharing started successfully!');

            // Explicitly stop the initial camera BEFORE starting the test phase camera
            // console.log('requestScreenCapture: Stopping initial camera...');
            // stopCamera();
            // isInitialCameraStopped.current = true; // Mark that we handled the stop

            // Stop initial camera only if it was started (e.g., for user photo)
            if (applicationSettings.userPhotoFeatureEnabled && isCameraOn) {
                console.log('requestScreenCapture: Stopping initial camera (as user photo was enabled)...');
                stopCamera();
                isInitialCameraStopped.current = true; // Mark that we handled the stop
            }

            // --- ADDED CHECK: Verify if a browser tab was shared ---
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            console.log('Screen share track settings:', settings); // For debugging

            if (!settings || settings.displaySurface !== 'window') {
                console.warn(`Incorrect surface shared: ${settings?.displaySurface}. Expected 'browser'. Showing warning.`);
                // Stop the incorrectly shared stream
                stream.getTracks().forEach(track => track.stop());

                // --- Use EXISTING warning mechanism ---
                setCurrentWarningType('incorrect_screen_share'); // Set a specific type for the message
                setWarningStartTime(Date.now());
                setShowWarning(true);
                // --- End Use EXISTING warning mechanism ---

                // Prevent further execution (do not start the test)
                return;
            }
            // --- END ADDED CHECK ---

            // Use setTimeout to allow hardware/browser to release the camera before restarting
            setTimeout(() => {
                const startTestCamera = async () => {
                    // console.log('requestScreenCapture (setTimeout): Attempting startCamera("test")...');
                    // try {
                    //     await startCamera('test'); // Wait for startCamera to attempt acquisition
                    //     console.log('requestScreenCapture (setTimeout): startCamera("test") initiated (async).');

                    //     // --- Set submitted state AFTER initiating camera start ---
                    //     // This allows the test UI to render, and useEffects will handle the camera state changes.
                    //     setSubmitted(true); // <<< SET SUBMITTED TO TRUE HERE
                    //     setIsFaceDetectionGracePeriod(true); // Start grace period

                    // } catch (startError) {
                    //     // This catch might not be strictly necessary if startCamera handles its own errors well,
                    //     // but it adds an extra layer of safety for unexpected issues during the call itself.
                    //     console.error('requestScreenCapture (setTimeout): Error occurred *during* the call to startCamera("test"):', startError);
                    //     // Handle failure to start the test camera
                    //     setCameraError("Failed to restart camera for the test. Please try again.");
                    //     setSubmitted(false); // Ensure we don't proceed to test phase
                    //     setIsFaceDetectionGracePeriod(false);
                    //     // Optionally stop screen sharing stream if camera fails?
                    //     if (stream) stream.getTracks().forEach(track => track.stop());
                    //     setMediaStream(null);
                    //     setShowInstructions(true); // Maybe go back to instructions? Or show a specific error popup.
                    // }

                     // --- Timer Initialization Logic ---
                     if (!isResumingAfterPause) { // Only set/reset timer if NOT resuming from a pause
                        let durationInSeconds = 600; // Default to 10 minutes (600 seconds)
                        if (applicationSettings) {
                            if (applicationSettings.testDurationInterval && Number(applicationSettings.testDurationInterval) > 0) {
                                durationInSeconds = Number(applicationSettings.testDurationInterval) * 60;
                                console.log(`Test timer initialized from testDurationInterval: ${durationInSeconds} seconds (${applicationSettings.testDurationInterval} minutes)`);
                            } else if (applicationSettings.testDurationSeconds && Number(applicationSettings.testDurationSeconds) > 0) {
                                durationInSeconds = Number(applicationSettings.testDurationSeconds);
                                console.log(`Test timer initialized from testDurationSeconds: ${durationInSeconds} seconds`);
                            } else {
                                console.log(`Test timer initialized to default (600s) due to missing/invalid duration in settings.`);
                            }
                    } else {
                        console.log(`Test timer initialized to default (600s) because applicationSettings are not available.`);
                    }
                    setTimer(durationInSeconds);
                    console.log(`Timer initialized to ${durationInSeconds} seconds.`);
                    markTestStart(); // Mark start only on the first full initiation
                }
                else {
                    console.log(`Resuming test. Timer continues from ${timer} seconds.`);
                }

                    if (applicationSettings.liveVideoStreamEnabled) {

                        
                        console.log('requestScreenCapture (setTimeout): Live video stream enabled. Attempting startCamera("test")...');
                        try {
                            await startCamera('test'); // Wait for startCamera to attempt acquisition
                            // If startCamera fails (e.g. no camera), it sets cameraError.
                            // The test continues; UI will show the error or "unavailable".
                            console.log('requestScreenCapture (setTimeout): startCamera("test") initiated (async).');
                        } catch (startError) {
                            // This catch is for errors *during the call itself*, not async errors from getUserMedia.
                            // startCamera handles its own errors by setting cameraError state.
                            console.error('requestScreenCapture (setTimeout): Error occurred *during* the call to startCamera("test"):', startError);
                            setCameraError("Failed to restart camera for the test. Please try again.");
                            // Stop screen sharing if camera fails to start for test
                            //if (stream) stream.getTracks().forEach(track => track.stop());
                            //stream.getTracks().forEach(track => track.stop());
                            //setMediaStream(null);
                            // Do not proceed to setSubmitted(true)
                            //setShowInstructions(true); // Go back to instructions or show error
                            //return; // Exit to prevent setting submitted
                        }
                    } else {
                        console.log('requestScreenCapture (setTimeout): Live video stream is DISABLED by settings. Camera will not be started for test.');
                        // Ensure camera is off if it was somehow on from initial phase
                        if (isCameraOn) stopCamera();
                    }
                    

                    // --- Set submitted state AFTER initiating camera start (or deciding not to) ---
                    // This allows the test UI to render, and useEffects will handle the camera state changes.
                    setSubmitted(true); // <<< SET SUBMITTED TO TRUE HERE
                    setIsFaceDetectionGracePeriod(true); // Start grace period
                    setIsTimerPaused(false); // <<< RESUME THE TIMER by unpausing
                    //markTestStart(); // Call backend to mark test start


                };
                startTestCamera(); // Pass phase for logging
            }, 200); // Increased delay slightly (e.g., 200ms)

            setSubmitted(true); // <<< SET SUBMITTED TO TRUE HERE TO START TEST PHASE
            setIsFaceDetectionGracePeriod(true);

            //markTestStart(); // Call backend to mark test start

            // const videoTrack = stream.getVideoTracks()[0];
            videoTrack.onended = () => {
                console.log("Screen sharing ended by user or system.");
                setIsScreenSharingStopped(true); // Set flag first
                handleStopSharingViolation();
            };
        } catch (error) {
            console.error('Error requesting screen capture:', error);
            // Don't set submitted=true if permission denied
            setShowPermissionError(true);
            setIsFaceDetectionGracePeriod(false); 
            // If screen share fails, ensure timer isn't left in a paused state if it was about to start
            if(isResumingAfterPause)
            {
                setIsTimerPaused(true); // Pause the timer if it was paused before
            }
            else { // Or if it was the initial attempt and timer was about to start
                setIsTimerPaused(false);
            }
            // Ensure camera state is consistent if screen share fails
            if (isCameraOn) {
                console.log("Screen share failed, ensuring initial camera is stopped.");
                stopCamera();
            }
        }
    };

    const handleStopSharingViolation = () => {
        // if (isTimeOver) {
        //     console.log("Screen sharing stopped after time over. Ignoring violation.");
        //     return;
        // }
        if (isTimeOver || isTestEffectivelyOver) { // Added isTestEffectivelyOver
            console.log("Screen sharing stopped after time over or test effectively over. Ignoring violation.");
            return;
            setIconViolationType(null); // Ensure icon is cleared if test ends
        }
        console.log("Violation detected: Screen sharing stopped");
        setIsTimerPaused(true);
        // Stop the stream tracks if they exist
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
        }
        setMediaStream(null); // Clear the state
        // setWarningStartTime(Date.now());
        // setCurrentWarningType('screenshare_stop'); // Set type
        setWarningStartTime(Date.now()); // Keep for logging duration
        setIconViolationType('screenshare_stop'); // Set icon type
        // isScreenSharingStopped is already set true by onended handler
        setShowWarning(false); // Ensure overlay is hidden
        setCurrentWarningType(null); // Ensure popup doesn't show a stale message
        setShowScreenShareRequiredError(true); // Directly show the re-share prompt
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
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/screenshots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send both screenshot and userId
                body: JSON.stringify({ screenshotData: screenshot, userId: userId }), // <-- UPDATED HERE
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
        // if (submitted && mediaStream && userId && !isTimeOver && !isTestEffectivelyOver) { // Added !isTestEffectivelyOver

        if (settingsLoading || !applicationSettings) {
            return; // Wait for settings
        }
        if (applicationSettings.periodicScreenshotsEnabled &&
            submitted &&
            mediaStream &&
            userId &&
            !isTimeOver &&
            !isTestEffectivelyOver) {
            const intervalTime = (applicationSettings.screenshotIntervalSeconds || 30) * 1000; // Default to 30 seconds if not set
            console.log(`Setting up periodic screenshots every ${intervalTime / 1000} seconds.`);
            const interval = setInterval(() => {
                console.log('Capturing periodic screenshot...');
                captureScreenshot();
            }, intervalTime); 
            return () => clearInterval(interval);
        }
    }, [applicationSettings, settingsLoading, submitted, mediaStream, captureScreenshot, userId, isTimeOver, isTestEffectivelyOver]);

    // [submitted, mediaStream, captureScreenshot, userId, isTimeOver, isTestEffectivelyOver]); // Added isTestEffectivelyOver


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

        // --- Effect to manage Face Detection Grace Period Timeout ---
        useEffect(() => {
            let gracePeriodTimer;
            // Only run the timeout logic when the grace period starts
            if (isFaceDetectionGracePeriod) {
                console.log("Starting face detection grace period (3 seconds)...");
                gracePeriodTimer = setTimeout(() => {
                    console.log("Face detection grace period ended.");
                    setIsFaceDetectionGracePeriod(false);
                }, 3000); // 3-second grace period (adjust if needed)
            }
    
            // Cleanup function to clear the timer if the component unmounts
            // or if the grace period state changes before the timer finishes.
            return () => {
                if (gracePeriodTimer) {
                    clearTimeout(gracePeriodTimer);
                    console.log("Cleared face detection grace period timer.");
                }
            };
        }, [isFaceDetectionGracePeriod]); // Run only when isFaceDetectionGracePeriod changes    

    // --- Effect to handle Audio Hook Errors ---
    useEffect(() => {
        if (hookAudioError) {
            setAudioSetupError(hookAudioError);
            // Optionally, stop the test or show a blocking error?
            console.error("Audio Monitoring Setup Error:", hookAudioError);
        } else {
            setAudioSetupError(null); // Clear error if hook recovers (e.g., permission granted later)
        }
    }, [hookAudioError]);

    useEffect(() => {
        // --- Reset everything if monitoring stops ---
        if (!isAudioMonitoringActive) { // isAudioMonitoringActive already includes !isTestEffectivelyOver
            consecutiveNoiseCountRef.current = 0;
            firstNoiseViolationInSequenceTimestampRef.current = null;
            lastNoiseViolationTimestampRef.current = null;
            // console.log("[Noise Effect] Monitoring stopped, resetting counters.");
            setIconViolationType(null); // Ensure icon is hidden if monitoring stops
            // Ensure warning is hidden if monitoring stops
            if (showWarning && currentWarningType === 'high_noise') {
                 setShowWarning(false);
                 setCurrentWarningType(null);
                 setWarningStartTime(null);
            }
            return;
        }

        const now = Date.now();

        if (isNoiseLevelHigh) {
            // --- Noise is currently HIGH ---
            console.log(`[Noise Effect] High noise detected at ${now}`);
            lastNoiseViolationTimestampRef.current = now; // Always update last violation time when high

            if (firstNoiseViolationInSequenceTimestampRef.current === null) {
                // --- Case 1: This is the FIRST violation in a potential sequence ---
                console.log("   Starting new noise sequence.");
                firstNoiseViolationInSequenceTimestampRef.current = now;
                consecutiveNoiseCountRef.current = 1;
                console.log(`   [consecutiveNoiseCountRef] set to 1. First timestamp: ${firstNoiseViolationInSequenceTimestampRef.current}`);

            } else {
                // --- Case 2: This is a SUBSEQUENT violation in an existing sequence ---
                const timeSinceFirst = now - firstNoiseViolationInSequenceTimestampRef.current;
                console.log(`   Continuing sequence. Time since first: ${timeSinceFirst}ms (Window: ${NOISE_TIME_WINDOW_MS}ms)`);

                // Check if the sequence's time window has expired
                if (timeSinceFirst > NOISE_TIME_WINDOW_MS) {
                    // The sequence timed out before reaching the required count.
                    // Reset and start a NEW sequence with THIS violation.
                    console.log("   Time window expired before reaching count. Resetting and starting new sequence.");
                    firstNoiseViolationInSequenceTimestampRef.current = now;
                    consecutiveNoiseCountRef.current = 1;
                    console.log(`   [consecutiveNoiseCountRef] reset to 1. New first timestamp: ${firstNoiseViolationInSequenceTimestampRef.current}`);
                } else {
                    // Time window is still valid. Increment count (only if it hasn't reached the threshold yet? No, let it increment)
                    // We only increment if this isn't the *exact* same timestamp as the first to avoid double counting on rapid calls
                    if (now > firstNoiseViolationInSequenceTimestampRef.current) {
                         // Only increment if it's truly a subsequent event in time
                         // Check if we are *just* hitting the threshold or already past it
                         if (consecutiveNoiseCountRef.current < REQUIRED_CONSECUTIVE_NOISE_COUNT) {
                            consecutiveNoiseCountRef.current += 1;
                            console.log(`   [consecutiveNoiseCountRef] incremented to ${consecutiveNoiseCountRef.current}.`);
                         } else {
                            // Count is already at or above threshold, just log that noise continues
                            console.log(`   [consecutiveNoiseCountRef] already at ${consecutiveNoiseCountRef.current} (>=${REQUIRED_CONSECUTIVE_NOISE_COUNT}). Noise continues.`);
                         }
                    }


                    // Check if the threshold is met or exceeded WITHIN the time window
                    if (consecutiveNoiseCountRef.current >= REQUIRED_CONSECUTIVE_NOISE_COUNT) {
                        console.warn(`   [Alert Condition Met] ${consecutiveNoiseCountRef.current} violations within ${timeSinceFirst}ms.`);

                        // Show warning only if not already showing this specific warning
                        // if (!showWarning || currentWarningType !== 'high_noise') {
                        //     console.log("   Triggering 'high_noise' warning popup.");
                        //     setShowWarning(true);
                        // Trigger icon only if not already showing this specific icon
                        if (iconViolationType !== 'high_noise') {
                            console.log("   Triggering 'high_noise' icon.");
                            setIconViolationType('high_noise');
                            setShowWarning(false); // Ensure overlay is hidden
                            setCurrentWarningType('high_noise');
                            // Set warning start time only when it *first* triggers
                            if (!warningStartTime) { // Or check if currentWarningType was different
                                setWarningStartTime(now);
                            }
                        }
                        // --- DO NOT RESET COUNTERS HERE ---
                    }
                }
            }
        } else {
            // --- Noise is currently LOW ---
            // console.log(`[Noise Effect] Noise level normal at ${now}`);

            // Check if a sequence was active and if enough time has passed since the LAST violation
            if (lastNoiseViolationTimestampRef.current !== null) {
                const timeSinceLastViolation = now - lastNoiseViolationTimestampRef.current;
                // console.log(`   Time since last violation: ${timeSinceLastViolation}ms (Reset threshold: ${NOISE_RESET_INACTIVITY_MS}ms)`);

                if (timeSinceLastViolation > NOISE_RESET_INACTIVITY_MS) {
                    // --- Reset the sequence due to inactivity ---
                    console.log(`   [Resetting Counters] Noise low for ${timeSinceLastViolation}ms (>${NOISE_RESET_INACTIVITY_MS}ms). Resetting sequence.`);
                    consecutiveNoiseCountRef.current = 0;
                    firstNoiseViolationInSequenceTimestampRef.current = null;
                    lastNoiseViolationTimestampRef.current = null; // Clear last violation time too

                    // --- Hide the warning IF it was specifically a high_noise warning ---
                    // (The close button logic already handles preventing closure while noise is high)
                    // This handles hiding it automatically if noise stays low long enough.
                    if (showWarning && currentWarningType === 'high_noise') {
                       console.log("Hiding 'high_noise' popup (should be icon) due to inactivity reset.");
                        setShowWarning(false);
                        setCurrentWarningType(null);
                        setWarningStartTime(null);
                    }
                    // Clear icon if it was for high_noise
                    if (iconViolationType === 'high_noise') {
                        setIconViolationType(null);
                        // warningStartTime for high_noise would be cleared when logging its duration if needed
                    }
                }
                  
                // else: Noise is low, but not for long enough to reset yet. Do nothing.
            }
            // else: Noise is low, and no sequence was active. Do nothing.
        }

    }, [
        isNoiseLevelHigh,
        isAudioMonitoringActive,
        showWarning, // Need this to check if we need to show/hide
        currentWarningType, // Need this to check if we need to show/hide
        warningStartTime, // Need this for setting start time correctly
        // isTestEffectivelyOver is implicitly handled by isAudioMonitoringActive
    ]);
        

    // --- UPDATED: Effect for Drawing Audio Waveform Visualization ---
    useEffect(() => {
        const canvas = audioCanvasRef.current;
        if (!canvas) return; // Exit if canvas ref is not ready

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // --- Clear Canvas ---
        ctx.clearRect(0, 0, width, height);

        // --- Draw based on state ---
        if (submitted && mediaStream && isAudioMonitoring && waveformArray && waveformArray.length > 0 && !isTestEffectivelyOver) { // Added !isTestEffectivelyOver
            // --- Draw Background ---
            ctx.fillStyle = '#f0f0f0'; // Light grey background
            ctx.fillRect(0, 0, width, height);

            // --- Draw Center Line ---
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = '#aaaaaa';
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();

            // --- Draw Waveform ---
            ctx.lineWidth = 1.5; // Slightly thicker line
            // Set color based on noise level threshold
            ctx.strokeStyle = isNoiseLevelHigh ? '#e74c3c' : '#3498db'; // Red if high, Blue if normal

            ctx.beginPath();

            const sliceWidth = width * 1.0 / waveformArray.length;
            let x = 0;

            for (let i = 0; i < waveformArray.length; i++) {
                // Normalize the 0-255 value to a range around the center line
                // Value 128 is silence (center)
                const v = waveformArray[i] / 128.0; // Normalize to 0-2 range
                const y = (v - 1.0) * (height * 0.4) + (height / 2); // Center vertically, scale amplitude

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            // ctx.lineTo(width, height / 2); // Connect end back to center? Optional.
            ctx.stroke(); // Draw the path

            // --- Draw dBFS Text (Optional) ---
            ctx.fillStyle = isNoiseLevelHigh ? '#c0392b' : '#2980b9'; // Darker Red/Blue
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(`${currentDecibels.toFixed(1)} dBFS`, width - 5, 2);

        } else {
            // --- Draw Disabled State ---
             ctx.fillStyle = '#cccccc'; // Grey background
             ctx.fillRect(0, 0, width, height);
             ctx.fillStyle = '#666666';
             ctx.font = '12px Arial';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText('Audio Monitor Off', width / 2, height / 2);
        }
    // Dependencies: Draw when waveform data changes, threshold state changes, or monitoring status changes
    }, [waveformArray, isNoiseLevelHigh, currentDecibels, submitted, mediaStream, isAudioMonitoring, isTestEffectivelyOver]); // Added isTestEffectivelyOver
    // --- END UPDATED ---

    // ... (No changes needed here)
    // const isSubmitDisabled =
    //     settingsLoading || // Disable while settings are loading
    //     isCameraAvailable === null || // Still checking for camera
    //     !name || !!nameError ||
    //     !email || !!emailError ||
    //     !phone || !!phoneError ||
    //     !isCameraOn || !isVideoReady || // Camera must be fully ready
    //     numberOfFacesDetected !== 1 || // Exactly one face must be detected
    //     //isLookingAway || // <-- ADDED: User must be looking straight
    //     !detectorReady; // Detector must be ready

    // --- Calculate if submit button should be disabled ---
    const basicFormInvalid = !name || !!nameError || !email || !!emailError || !phone || !!phoneError;
    //let photoChecksFailed = false;
    let photoChecksFailedAndRequired = false; // Renamed for clarity
    // These checks are only relevant if the user photo feature is enabled
    if (applicationSettings?.userPhotoFeatureEnabled) {
        // photoChecksFailed =
        //     isCameraAvailable === null ||      // Still checking for camera availability
        //     isCameraAvailable === false ||     // Camera check completed and no camera found/error
        //     !detectorReady ||                // Face detector must be ready
        //     !isCameraOn ||                   // Camera must be on (intended state)
        //     !isVideoReady ||                 // Video stream must be ready and playing
        //     numberOfFacesDetected !== 1 ||   // Exactly one face must be detected
        //     isLookingAway;                   // User must not be looking away
        if (isCameraAvailable === true) { // Photo capture is attempted, so checks are required if camera IS available
            photoChecksFailedAndRequired =
                !detectorReady ||
                !isCameraOn ||
                !isVideoReady ||
                numberOfFacesDetected !== 1 ||
                isLookingAway;
        }
        // If isCameraAvailable === false, photoChecksFailedAndRequired remains false.
        // Submission is allowed, photo is skipped. cameraAvailabilityError will be shown.
        // If isCameraAvailable === null, we disable submit separately.
    }

    const isSubmitDisabled =
        settingsLoading || // Disable while application settings are loading
        isLoading ||       // Disable while form is actively submitting to the backend
        basicFormInvalid || // Basic form fields (name, email, phone) must be valid
        //photoChecksFailed;  // This will be true only if photo feature is enabled AND one of its specific checks failed.
                            // If photo feature is disabled, photoChecksFailed remains false.
        (applicationSettings?.userPhotoFeatureEnabled && isCameraAvailable === null) || // Disable if checking camera and photo is a feature
        photoChecksFailedAndRequired;  // True if photo enabled, camera available, AND operational checks fail.
    // --- Determine Submit Button Text ---
    let submitButtonText = 'Submit Details';
    if (settingsLoading) {
        submitButtonText = 'Loading Settings...';
    } else if (isLoading) {
        submitButtonText = 'Submitting...';
    } else if (basicFormInvalid) {
        submitButtonText = 'Fill Details Correctly';
    } 
    else if(applicationSettings?.userPhotoFeatureEnabled)
    {
        if (isCameraAvailable === null) {
            submitButtonText = 'Checking Camera...';
            } else if (isCameraAvailable === true && photoChecksFailedAndRequired) { 
            // Photo feature is on, camera IS available, but operational checks fail
            if (!detectorReady) submitButtonText = 'Loading Detector...';
            else if (!isCameraOn) submitButtonText = 'Starting Camera...';
            else if (!isVideoReady) submitButtonText = 'Initializing Camera...';
            else if (numberOfFacesDetected !== 1) submitButtonText = 'Align Face (1 needed)';
            else if (isLookingAway) submitButtonText = 'Look Straight';
        }
        // If isCameraAvailable === false (no camera), and photo feature is on,
        // the button text remains 'Submit Details'. The cameraAvailabilityError
        // message on the form will explain that photo capture will be skipped.
        // Submission is NOT disabled in this case.
    }
    // If all checks pass (or photo feature is disabled and basic form is valid), text remains 'Submit Details'.



    // --- Calculate if all instruction checkboxes are checked from the state object ---
    const allInstructionsChecked = Object.values(instructionChecks).every(isChecked => isChecked === true);


    // --- Handler for Instruction Checkbox Change ---
    const handleInstructionCheckChange = (event) => {
        const { id, checked } = event.target;
        setInstructionChecks(prevChecks => ({ ...prevChecks, [id]: checked }));
    };


    // console.log(
    //     'Render State - settingsLoading:', settingsLoading,
    //     'applicationSettings:', JSON.stringify(applicationSettings, null, 2)
    // );
    // --- Calculate displayMinutes for instructions ---

    // Condition for showing the main test environment (timer, camera, Google Form etc.)
    const showTestEnvironment = submitted &&
                                !isTestEffectivelyOver &&
                                (mediaStream || (applicationSettings && !applicationSettings.periodicScreenshotsEnabled));

    let displayMinutes = 10; // Default value if settings are not loaded or field is missing
    if (applicationSettings) {
        if (applicationSettings.testDurationInterval && Number(applicationSettings.testDurationInterval) > 0) {
        } else if (applicationSettings.testDurationSeconds && Number(applicationSettings.testDurationSeconds) > 0) {
            // Fallback to testDurationSeconds if testDurationInterval is not available/valid
            displayMinutes = Math.floor(Number(applicationSettings.testDurationSeconds) / 60);
        }
        // If neither is present and valid from fetched settings, it remains the initial default (10)
    }


    // --- JSX Rendering ---
    return (
        <div className="form-container">

            {/* --- Initial Form OR Test Area --- */}
            {!showInstructions && !submitted ? ( // Show form if instructions aren't shown AND test hasn't started
                <form className="form-card" onSubmit={handleSubmit}>
                    <h2>Your Details</h2>
                    {/* ... (Name, Email, Phone inputs - unchanged) ... */}
                    <div className="form-group">
                    <div className="input-container">
                        <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => {
                            // No specific action needed here for the visual effect
                        }}
                        disabled={isLoading} // <<< ADD THIS
                        onBlur={() => checkFieldExists('name', name, setNameError)}
                        placeholder="Name" 
                        required
                        aria-invalid={!!nameError}
                        aria-describedby="name-error"
                        />
                        <label htmlFor="name">Name</label> {/* Label text remains the same */}
                    </div>
                    <p
                        id="name-error"
                        className={`error-message ${nameError ? 'visible' : ''}`}
                    >
                        {nameError || '\u00A0'}
                    </p>
                    </div>
                    {/* Repeat this structure for email and phone */}
                    <div className="form-group">
                    <div className="input-container">
                        <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => {
                            // No specific action needed here
                        }}
                        disabled={isLoading} // <<< ADD THIS
                        onBlur={() => checkFieldExists('email', email, setEmailError)}
                        placeholder="Email" 
                        required
                        aria-invalid={!!emailError}
                        aria-describedby="email-error"
                        />
                        <label htmlFor="email">Email</label>
                    </div>
                    <p
                        id="email-error"
                        className={`error-message ${emailError ? 'visible' : ''}`}
                    >
                        {emailError || '\u00A0'}
                    </p>
                    </div>
                    <div className="form-group">
                    <div className="input-container">
                        <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => {
                        
                        //setPhone(e.target.value);
                        const inputValue = e.target.value;
                            // Remove non-numeric characters
                            const numericValue = inputValue.replace(/[^0-9]/g, '');
                            // Limit to 10 digits
                            const limitedValue = numericValue.slice(0, 10);
                            setPhone(limitedValue);
                            // Clear Unique ID if phone becomes invalid during typing
                            if (!validatePhone(limitedValue)) {
                               
                                setUniqueId(null);
                            }
                    }}
                        onFocus={() => {
                            // No specific action needed here
                        }}
                        disabled={isLoading} // <<< ADD THIS
                        //onBlur={() => checkFieldExists('phone', phone, setPhoneError)}
                        onBlur={async () => {
                        const isValidAfterCheck = await checkFieldExists('phone', phone, setPhoneError);
                        if (isValidAfterCheck && validatePhone(phone)) {
                        // isValidAfterCheck being true means checkFieldExists didn't set an error
                        // and validatePhone confirms the format is correct.
                        // Generate a unique ID, e.g., prefix + last 4 of phone + part of timestamp
                        const newUniqueId = `UID-${phone.slice(-4)}-${Date.now().toString().slice(-6)}`;
                        setUniqueId(newUniqueId);
                        } else {
                            setUniqueId(null);
                        }
                        }}
                        placeholder="Phone Number" 
                        required
                        aria-invalid={!!phoneError}
                        aria-describedby="phone-error"
                        />
                        <label htmlFor="phone">Phone Number</label>
                    </div>
                    <p
                        id="phone-error"
                        className={`error-message ${phoneError ? 'visible' : ''}`}
                    >
                        {phoneError || '\u00A0'}
                    </p>
                    </div>

                    {/* College Name Field (Disabled) */}
                    <div className="form-group">
                        <div className="input-container">
                            <input
                                type="text"
                                id="collegeName"
                                value={collegeName}
                                disabled // This field is always disabled
                                readOnly // Good practice for disabled, pre-filled fields
                                placeholder="College Name" // Will be overridden by value if present
                            />
                            <label htmlFor="collegeName">College Name</label>
                        </div>
                        {/* No error display needed as it's auto-filled and disabled */}
                    </div>

                    {/* --- Camera Section (Simplified) --- */}
                     {/* --- Camera Section: Conditionally Rendered --- */}
                    {(settingsLoading || (applicationSettings && applicationSettings.userPhotoFeatureEnabled)) && (
                        <div className="form-group camera-section">

                            {/* 1. Settings are loading placeholder */}
                            {settingsLoading && (
                                <div className="camera-placeholder-box" style={{ minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ccc', borderRadius: '8px' }}>
                                    <p>Loading camera settings...</p>
                                </div>
                            )}

                            {/* 2. Settings loaded AND user photo feature is enabled */}
                            {!settingsLoading && applicationSettings?.userPhotoFeatureEnabled && (
                                <>
                                    {/* Display initial camera availability error if feature is ON but camera NOT available */}
                                    {isCameraAvailable === false && cameraAvailabilityError && (
                                        <p className="error-message visible">{cameraAvailabilityError}</p>
                                    )}

                                    {/* Display operational camera error if feature is ON and camera IS available but failed to start */}
                                    {isCameraAvailable === true && cameraError && (
                                        <p className={`error-message ${cameraError ? 'visible' : ''}`}>{cameraError || '\u00A0'}</p>
                                    )}

                                    {/* Render video feed and warnings ONLY if camera is available */}
                                    {isCameraAvailable === true && (
                                        <>
                                            {/* Face Count Warning */}
                                            <p
                                                className={`error-message ${isCameraOn && isVideoReady && numberOfFacesDetected !== 1 ? 'visible' : ''}`}
                                                style={isCameraOn && isVideoReady && numberOfFacesDetected !== 1 ? { color: 'orange', fontWeight: 'bold' } : {}}
                                            >
                                                {isCameraOn && isVideoReady && numberOfFacesDetected !== 1
                                                    ? (numberOfFacesDetected === 0 ? 'Warning: No face detected.' : 'Warning: Multiple faces detected.')
                                                    : '\u00A0'}
                                            </p>

                                            {/* Looking Away Warning */}
                                            <p
                                                className={`error-message ${isCameraOn && isVideoReady && numberOfFacesDetected === 1 && isLookingAway ? 'visible' : ''}`}
                                                style={isCameraOn && isVideoReady && numberOfFacesDetected === 1 && isLookingAway ? { color: 'orange', fontWeight: 'bold' } : {}}
                                            >
                                                {isCameraOn && isVideoReady && numberOfFacesDetected === 1 && isLookingAway ? 'Warning: Look straight into the screen.' : '\u00A0'}
                                            </p>

                                            {/* Live feed container */}
                                            <div className="camera-live-container">
                                                <video
                                                    ref={videoRef}
                                                    autoPlay
                                                    playsInline
                                                    muted
                                                    className="camera-video-feed"
                                                    style={{ display: isCameraOn ? 'block' : 'none', transform: 'scaleX(-1)' }}
                                                />
                                                {/* Placeholder if camera is available but not yet on/ready */}
                                                {!isCameraOn && (
                                                    <div className="camera-placeholder-box" style={{ minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ccc', borderRadius: '8px' }}>
                                                        <p>Camera starting...</p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                    {/* Placeholder if camera availability is still being checked (isCameraAvailable === null) */}
                                    {isCameraAvailable === null && (
                                        <div className="camera-placeholder-box" style={{ minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ccc', borderRadius: '8px' }}>
                                            <p>Checking for camera...</p>
                                        </div>
                                    )}
                                </>
                            )}
                            {/* Hidden canvas for capture - always include if section is rendered, display:none handles visibility */}
                            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                        </div>
                    )}
                    {/* If !settingsLoading && !applicationSettings.userPhotoFeatureEnabled, the entire block above is skipped. */}
                    {/* --- End Camera Section --- */}

                    {/* General Form Error */}
                    <p className={`error-message ${error ? 'visible' : ''}`}>
                        {error || '\u00A0'}
                    </p>

                    <button
                        type="submit"
                        className="submit-button"
                        disabled={isSubmitDisabled}
                    >
                        {(isLoading || settingsLoading) && <div className="spinner"></div>}
                        {submitButtonText}
                    </button>
                </form>
            ) : showTestEnvironment ? ( // Test Area: Show if submitted, test not over, AND (screen share active OR screenshots are disabled)
                <div className="google-form-page">
                    <div className="google-form-container" ref={googleFormRef}>
                        <div className="timer-container">
                            <p className={`custom-timer ${isOvertimeActive ? 'overtime-active' : ''}`}>
                                Time remaining: {timer !== null ?
                                    `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}` :
                                    (settingsLoading ? 'Loading...' : 'Starting...')}
                            </p>
                        </div>
                        <div className="camera-feed">
                            <div className="camera-box">
                                {settingsLoading ? (
                                    <p className="camera-placeholder"></p>
                                ) : applicationSettings?.liveVideoStreamEnabled ? (
                                    <>
                                        {isCameraAvailable === false ? (
                                            <p className="camera-placeholder"></p>
                                        ) : cameraError ? (
                                            <p className="error-message camera-error">{cameraError}</p>
                                        ) : isCameraOn ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    // muted // Ensure muted
                                    // className="camera-video-feed"
                                    // style={{ display: isCameraOn ? 'block' : 'none', transform: 'scaleX(-1)' }} // Flip horizontally
                                    className={`camera-video ${!isCameraOn || !isVideoReady ? 'hidden' : ''}`}
                                                style={{ transform: 'scaleX(-1)' }}
                                ></video>
                           



                                ) : (
                                            <p className="camera-placeholder"></p>
                                        )}
                                    </>
                                ) : (
                                    <p className="camera-placeholder"></p>



                                // {settingsLoading ? (
                                //     <p className="camera-placeholder"></p>
                                // ) : applicationSettings?.liveVideoStreamEnabled ? (
                                //     <>
                                //         {isCameraAvailable === false ? (
                                //             <p className="camera-placeholder"></p>
                                //         ) : cameraError ? (
                                //             <p className="error-message camera-error">{cameraError}</p>
                                //         ) : isCameraOn ? ( // <-- CHANGE HERE: Render video if camera is ON
                                //             <video // Render video element if camera is intended ON
                                //                 ref={videoRef}
                                //                 autoPlay
                                //                 playsInline
                                //                 muted
                                //                 className={`camera-video ${!isCameraOn || !isVideoReady ? 'hidden' : ''}`}
                                //                 style={{ transform: 'scaleX(-1)' }}
                                //             ></video>
                                //         ) : (
                                //             // Fallback if camera should be on but isn't (e.g., startCamera not called yet, or silently failed after being available)
                                //             // This also covers if isCameraAvailable is null initially.
                                //             // If isCameraOn is false, this branch won't be hit due to the parent condition.
                                //             <p className="camera-placeholder"></p>
                                //         )}
                                //     </>
                                // ) : (
                                //     <p className="camera-placeholder"></p>



                                
                                )}
                                {/* Show placeholder if camera is OFF */}
                                {/* {!isCameraOn && !cameraError && <p className="camera-placeholder">Camera off</p>} */}
                                {/* --- NEW: Violation Icon --- */}
                                {iconViolationType && (
                                    <div className={`violation-icon ${iconViolationType}`}>
                                        {/* You can use an actual icon font/SVG here */}
                                        {/* Example: Using a simple exclamation mark */}
                                        !
                                    </div>
                                )}
                                {/* --- END NEW --- */}

                            </div>
                            {/* Display Audio Setup Error if present */}
                            {/* {audioSetupError && <p className="error-message audio-error">{audioSetupError}</p>} */}
                            {applicationSettings?.noiseDetectionEnabled && audioSetupError && (
                                <p className="error-message audio-error">
                                    Audio monitoring issue: {audioSetupError}. Test will continue without this feature.
                                </p>
                            )}

                            {/* Optional: Display current decibel level for debugging */}
                            {/* {isAudioMonitoring && <p>Audio Level: {currentDecibels.toFixed(1)} dBFS</p>} */}
                        </div>
                         {/* --- ADDED: Audio Visualization Canvas --- */}

                         <div className="user-details-display enhanced overlay top-left"> {/* Add overlay classes */}
                        <div className="user-details-header">
                            {/* Optional: Icon */}
                            {/* <FaUserCircle className="user-icon" /> */}
                            <h3>Your Details</h3>
                        </div>
                        <div className="user-details-body">
                            <div className="detail-item">
                                {/* <FaUserCircle className="detail-icon" /> */}
                                <span className="detail-label">Name:</span>
                                <span className="detail-value">{name}</span>
                            </div>
                            <div className="detail-item">
                                {/* <FaEnvelope className="detail-icon" /> */}
                                <span className="detail-label">Email:</span>
                                <span className="detail-value">{email}</span>
                            </div>
                            <div className="detail-item">
                                {/* <FaPhone className="detail-icon" /> */}
                                <span className="detail-label">Phone:</span>
                                <span className="detail-value">{phone}</span>
                            </div>
                             {/* Display Unique ID if available */}
                            {uniqueId && (
                                <div className="detail-item">
                                    
                                    <span className="detail-label">Unique ID:</span>
                                    <span className="detail-value">{uniqueId}</span>
                                 </div>
                             )}
                        </div>
                    </div>

                    {/* --- NEW: Email Reminder Message --- */}
                    <div className="email-reminder-message ">
                        <p>
                            <strong>Important:</strong> Please use the email address{' '}
                            <strong>({email})</strong> you entered during registration
                            when filling out the test form below.
                            {/* --- ADDED LINE --- */}
                            <br /> {/* Add a line break for clarity */}
                            <br /> {/* Add a line break for clarity */}
                            If it does not match, you will not be included in merit.
                            {/* --- END ADDED LINE --- */}
                        </p>
                    </div>
                    {/* --- END NEW: Email Reminder Message --- */}

                         {/* <div className="audio-visualization-container">
                                <canvas
                                    ref={audioCanvasRef}
                                    width="180" // Adjust width as needed
                                    height="60" // Adjust height as needed
                                    className="audio-graph"
                                ></canvas>
                            </div> */}
                            {/* --- END ADDED --- */}

                        {/* Google Form Loading Logic */}
                        {isLoadingGoogleForm && (
                            <div className="loading-message" style={{padding: '20px', textAlign: 'center'}}>
                                <p>Loading exam form, please wait...</p>
                                <div className="spinner" style={{margin: '20px auto'}}></div>
                            </div>
                        )}
                        {errorLoadingGoogleForm && !isLoadingGoogleForm && (
                            <div className="error-message-container" style={{padding: '20px', textAlign: 'center', color: 'red'}}>
                                <p>{errorLoadingGoogleForm}</p>
                                {/* Optionally, add a retry button or contact support message */}
                            </div>
                        )}
                        {googleFormUrl && !isLoadingGoogleForm && !errorLoadingGoogleForm && (
                            <iframe
                                src={googleFormUrl} // <-- DYNAMIC URL
                                className="google-form-iframe"
                                title="Google Form Test"
                                frameBorder="0" marginHeight="0" marginWidth="0"
                                allow="camera; microphone" // Optional: if the Google Form itself needs these
                            >Loading Google Form…</iframe>
                        )}
                        {!googleFormUrl && !isLoadingGoogleForm && !errorLoadingGoogleForm && !submitted && (
                            // This case should ideally not be hit if submitted is true and other conditions are met
                            // but acts as a fallback if the form URL is simply not available after trying.
                            <div className="error-message-container" style={{padding: '20px', textAlign: 'center'}}>
                                <p>The exam form could not be loaded. Please try again later or contact support.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : submitted && isTestEffectivelyOver ? ( // Test effectively over (e.g., form submitted or time up)
                <div className="test-ended-container">
                    <div className="test-ended-card">
                        <svg className="checkmark-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                        <h1>Test Session Concluded</h1>
                        <p>
                            Your responses have been successfully recorded.
                            Thank you for participating!
                        </p>
                        <p className="test-ended-note">
                            You may now close this window.
                        </p>
                        {/* Optional: Add a button that attempts to close the window, though browser support varies */}
                        {/* <button className="close-window-button" onClick={() => window.close()}>Close Window</button> */}
                    </div>
                {/* </div>
            ) : submitted && !mediaStream && !showPermissionError ? ( // Waiting for screen share after agreeing */}
                </div> // Waiting for screen share after agreeing, ONLY if screenshots are enabled
                ) : submitted && 
                !mediaStream && 
                !showPermissionError && 
                applicationSettings && applicationSettings.periodicScreenshotsEnabled ? ( 
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
                        {/* --- Corrected Instruction List Structure & Bindings --- */}
                        <div className="instructions-list">
                            {/* Instruction 1 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst1" checked={instructionChecks.inst1} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst1">You will have <strong> {displayMinutes} minutes</strong> to complete the test.</label>
                            </div>
                            {/* Instruction 2 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst2" checked={instructionChecks.inst2} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst2">Ensure you complete the test within the time limit shown in the top-right corner.</label>
                            </div>
                            {/* Instruction 3 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst3" checked={instructionChecks.inst3} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst3">During the test, <strong>do not</strong> switch to another application or program.</label>
                            </div>
                            {/* Instruction 4 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst4" checked={instructionChecks.inst4} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst4">Do not switch to another browser tab or window.</label>
                            </div>
                            {/* Instruction 5 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst5" checked={instructionChecks.inst5} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst5">Do not minimize the browser window.</label>
                            </div>
                            {/* Instruction 6 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst6" checked={instructionChecks.inst6} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst6">Do not turn off your screen or let your computer go to sleep.</label>
                            </div>
                            {/* Instruction 7 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst7" checked={instructionChecks.inst7} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst7">Do not interact with notifications (e.g., clicking on them).</label>
                            </div>
                            {/* Instruction 8 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst8" checked={instructionChecks.inst8} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst8">Do not disconnect from the internet or lose network connectivity.</label>
                            </div>
                            {/* Instruction 9 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst9" checked={instructionChecks.inst9} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst9">Do not close the browser or refresh the page.</label>
                            </div>
                            {/* Instruction 10 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst10" checked={instructionChecks.inst10} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst10">Do not stop sharing your screen.</label>
                            </div>
                            {/* Instruction 11 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst11" checked={instructionChecks.inst11} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst11">Do not obscure your face or allow others into the camera view.</label>
                            </div>
                            {/* Instruction 12 */}
                            <div className="instruction-item">
                                <input type="checkbox" id="inst12" checked={instructionChecks.inst12} onChange={handleInstructionCheckChange} />
                                <label htmlFor="inst12">Understand that violations may lead to warnings or disqualification.</label>
                            </div>

                            <br /> {/* Spacing */}

                             <p>If you perform any of the above actions:</p>
                             <ul>
                                 <li>You will receive a warning.</li>
                                 <li>Further violations may lead to disqualification.</li>
                             </ul>
                             <p>Click 'I Agree' below to start the test and share your screen.</p>
                         </div>
                         <button
                            className="agree-button"
                            //onClick={requestScreenCapture}
                            onClick={handleAgreeAndStartTest}
                            // disabled={!allInstructionsChecked} /* <<< This binding was already correct */
                            disabled={!allInstructionsChecked || settingsLoading}
                        >
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
                        <h2>
                            {currentWarningType === 'form_submitted' ? 'Submission Confirmed' : 'Warning'}
                        </h2>
                        {/* --- MODIFIED: Warning message based on currentWarningType --- */}
                        <p>
                            {currentWarningType === 'form_submitted' ? (
                                'Your Google Form submission has been successfully recorded.'
                            ) : (
                                `Violation detected. Please do not ${
                                    currentWarningType === 'tab_switch' ? 'switch tabs or minimize the browser' :
                                    //currentWarningType === 'screenshare_stop' ? 'stop screen sharing' :
                                    // These types now use the icon, but keep the message here in case they were somehow set to the popup
                                    //currentWarningType === 'no_face' || currentWarningType === 'multiple_face' ? 'leave the camera view or allow others in the camera view' :
                                    // currentWarningType === 'no_face' ? 'leave the camera view or obscure your face' :
                                    // currentWarningType === 'multiple_face' ? 'allow others in the camera view' :
                                    // currentWarningType === 'looking_away' ? 'look straight at the screen' : 
                                    // currentWarningType === 'high_noise' ? 'make excessive noise or ensure a quiet environment' : 
                                    // 'violate the test rules'
                                    //currentWarningType === 'high_noise' ? 'make excessive noise or ensure a quiet environment' :
                                    //currentWarningType === 'incorrect_screen_share' ? 'share the incorrect screen (please share the browser tab)' :
                                    'violate the test rules'
                                } again.`
                            )}
                        </p>

                        {/* --- MODIFIED: Always Render Close Blocked Message Paragraph --- */}
                        <p className={`close-blocked-info ${closeBlockedMessage ? 'visible' : ''}`}>
                            {/* Display message or a non-breaking space to maintain height */}
                            {closeBlockedMessage || '\u00A0'}
                        </p>
                        {/* --- END MODIFICATION --- */}

                        <button
                            className="close-button"
                            onClick={() => {
                                 let allowClose = true; // Assume close is allowed by default
                                 let blockReason = ''; // To store why it's blocked

                                 // Check if it's a face violation and if it's still active
                                //  if (currentWarningType === 'no_face') {
                                //      if (numberOfFacesDetected === 0) { // No face violation still active
                                //          allowClose = false;
                                //          blockReason = 'Please ensure your face is visible to close this warning.';
                                //          console.log("Close button clicked, but 'no_face' violation persists. Preventing close.");
                                //          // Optionally, add brief visual feedback like shaking the popup slightly? (More complex UI task)
                                //      }
                                //  } else if (currentWarningType === 'multiple_face') {
                                //      if (numberOfFacesDetected > 1) { // Multiple faces violation still active
                                //          allowClose = false;
                                //          blockReason = 'Please ensure only one face is visible to close this warning.';
                                //          console.log("Close button clicked, but 'multiple_face' violation persists. Preventing close.");
                                //      }
                                //  }
                                //  else if (currentWarningType === 'high_noise') {
                                //      if (isNoiseLevelHigh) { // High noise violation still active
                                //          allowClose = false;
                                //         blockReason = 'Please ensure a quiet environment to close this warning.';
                                //         console.log("Close button clicked, but 'high_noise' violation persists. Preventing close.");
                                //     }
                                // // } else if (currentWarningType === 'looking_away') { // <-- NEW CHECK
                                // //     console.log(`[Close Button Check] Checking 'looking_away'. Current isLookingAway state: ${isLookingAway}`); // DEBUG
                                // //     if (isLookingAway) { // Looking away violation still active
                                // //         allowClose = false;
                                // //          blockReason = 'Please ensure your face is looking at the screen to close this warning.';
                                // //          console.log("Close button clicked, but 'high_noise' violation persists. Preventing close.");
                                // //      }
                                //  }
                                
                                // The popup close button should *only* be blocked for specific, user-resolvable issues that triggered the popup.
                                 // Currently, only 'incorrect_screen_share' requires user action (re-sharing).
                                 // 'tab_switch' doesn't block the close button. 'form_submitted' is the end state.
                                 // Face/Noise/Screenshare_stop now use the icon and don't block the popup close.
                                 // Only proceed if the close is allowed
                                 if (allowClose) {


                                    // --- Clear any blocked message if closing is allowed ---
                                 if (closeBlockedTimeoutRef.current) {
                                    clearTimeout(closeBlockedTimeoutRef.current);
                                    closeBlockedTimeoutRef.current = null;
                                }
                                setCloseBlockedMessage('');
                                // --- END Clear ---

                                     console.log(`Close allowed for warning type: ${currentWarningType}. Proceeding with close and logging.`);
                                     const endTime = Date.now();
                                     const startTime = warningStartTime;
 
                                     // Log acknowledgement for specific violation types if needed
                                     if (startTime && userId && currentWarningType) {
                                         let triggerEventToLog;
                                         let shouldLogPopupClose = false;
 
                                         switch (currentWarningType) {
                                             case 'tab_switch':
                                                 triggerEventToLog = 'tab_switch'; // Changed event name for clarity
                                                 shouldLogPopupClose = true;
                                                 break;
                                            //  case 'screenshare_stop':
                                            //      triggerEventToLog = 'screenshare_stop'; // Changed event name
                                            //      shouldLogPopupClose = true;
                                            //      break;
                                            //  case 'high_noise':
                                            //      triggerEventToLog = 'high_noise'; // Changed event name
                                            //      shouldLogPopupClose = true;
                                            //      break;
                                            //  // Log acknowledgement for face issues ONLY if closing is allowed (meaning issue was resolved)
                                            //  case 'no_face':
                                            //      triggerEventToLog = 'no_face'; // Log acknowledgement when resolved and closed
                                            //      shouldLogPopupClose = true;
                                            //      break;
                                            //  case 'multiple_face':
                                            //      triggerEventToLog = 'multiple_face'; // Log acknowledgement when resolved and closed
                                            //      shouldLogPopupClose = true;
                                            // Note: screenshare_stop, high_noise, no_face, multiple_face, looking_away
                                             // are now handled by the icon and their duration is logged when the *condition resolves*,
                                             // not when a popup is closed.
                                                break;
                                            // case 'looking_away': // <-- NEW CASE
                                            //     triggerEventToLog = 'looking_away'; // Log acknowledgement when resolved and closed
                                            //     shouldLogPopupClose = true;
                                            //      break;
                                             case 'incorrect_screen_share':
                                                 triggerEventToLog = 'incorrect_screen_share'; // Log acknowledgement when resolved and closed
                                                 shouldLogPopupClose = true;
                                                 break;
                                             default:
                                                 triggerEventToLog = 'unknown_warning';
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
 
                                     // Reset warning states ONLY if close is allowed
                                     setShowWarning(false);
                                     setWarningStartTime(null);
                                     setCurrentWarningType(null);

                                    if (currentWarningType === 'incorrect_screen_share') {
                                        setShowInstructions(true); // Allow user to try again from instructions
                                    }
 
                                     if (isScreenSharingStopped) {
                                         setShowScreenShareRequiredError(true);
                                         setIsScreenSharingStopped(false);
                                     }
                                 } 
                                 else {
                                    // --- Show the blocked message ---
                                    setCloseBlockedMessage(blockReason);
                                    // Clear previous timeout if user clicks again quickly
                                    if (closeBlockedTimeoutRef.current) {
                                        clearTimeout(closeBlockedTimeoutRef.current);
                                    }
                                    // Set a new timeout to clear the message
                                    closeBlockedTimeoutRef.current = setTimeout(() => {
                                        setCloseBlockedMessage('');
                                        closeBlockedTimeoutRef.current = null;
                                    }, 4000); // Show message for 4 seconds
                                    // --- END Show blocked message ---
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
                                setIsScreenSharingStopped(false);
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
            {/* {submitted && isTimeOver && !isTestEffectivelyOver && ( // Only show if test not already over by form submission
                 <div className="popup-overlay">
                     <div className="popup blocked-message">
                        <h2>Time Over</h2>
                        <p>Your time for the test has expired.</p>
                        <button
                            className="close-button" // Or a new style like "ok-button"
                            onClick={() => {
                                setIsTestEffectivelyOver(true); // This will trigger the "Test Session Concluded" view
                            }}
                        >
                            OK
                        </button>
                     </div>
                </div>
            )} */}

            {/* --- End Popups --- */}

        </div> // End form-container
    );
};

export default Form;