import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Form.css'; // Import the CSS file for styling

const Form = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [googleFormBlocked, setGoogleFormBlocked] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false); // State to show instructions popup
    const [showWarning, setShowWarning] = useState(false); // State to show warning popup
    const [showPermissionError, setShowPermissionError] = useState(false); // State to show permission error dialog
    const [timer, setTimer] = useState(600); // Timer in seconds
    const [isTimeOver, setIsTimeOver] = useState(false); // State to track if the timer is over
    const [violations, setViolations] = useState(0); // Track the number of violations
    const googleFormRef = useRef(null); // Reference to the Google Form container
    const [mediaStream, setMediaStream] = useState(null); // Store the media stream
    const [isScreenSharingStopped, setIsScreenSharingStopped] = useState(false); // Flag to track if the warning is due to screen sharing being stopped

    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (nameError || emailError || phoneError) {
            setError('Please fix the errors before submitting.');
            return;
        }

        const userDetails = { name, email, phone };

        try {
            const response = await fetch('http://localhost:5000/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userDetails),
            });

            if (!response.ok) {
                throw new Error('User already exists or other error');
            }

            const data = await response.json();
            console.log(data);

            setShowInstructions(true); // Show instructions popup after form submission
        } catch (err) {
            setError(err.message);
        }
    };

    const checkFieldExists = async (field, value, setErrorCallback) => {
        if (!value) {
            setErrorCallback(`${field.charAt(0).toUpperCase() + field.slice(1)} is required.`);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/users/check-field', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ field, value }),
            });

            if (response.status === 409) {
                const data = await response.json();
                setErrorCallback(data.message); // Set error if the field already exists
            } else {
                setErrorCallback(''); // Clear the error if the field is available
            }
        } catch (err) {
            setErrorCallback('Error checking field availability.');
        }
    };

    // Handle visibility changes for the Google Form only
    useEffect(() => {
        if (submitted) {
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    setViolations((prev) => {
                        if (prev === 0) {
                            setShowWarning(true); // Show warning popup on the first violation
                        } else if (prev === 1) {
                            setGoogleFormBlocked(true); // Block the test on the second violation
                        }
                        return prev + 1; // Increment the violations count
                    });
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }
    }, [submitted]);

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

    // Function to handle violations when the user stops screen sharing
    const handleStopSharingViolation = () => {
        setViolations((prev) => {
            if (prev === 0) {
                // First violation: Show warning
                setShowWarning(true);
            } else if (prev === 1) {
                // Second violation: Block the test
                setGoogleFormBlocked(true);
            }
            return prev + 1; // Increment the violations count
        });
    };

    // Function to capture a screenshot from the media stream
    const captureScreenshot = useCallback(() => {
        if (!mediaStream) {
            console.error('Media stream is not available.');
            return;
        }

        const videoTrack = mediaStream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);

        imageCapture
            .grabFrame()
            .then((bitmap) => {
                // Convert the bitmap to a canvas
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext('2d');
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

                // Convert the canvas to a data URL (base64 image)
                const screenshot = canvas.toDataURL('image/png');

                // Send the screenshot to the backend
                saveScreenshotToServer(screenshot);
                console.log('Screenshot captured successfully!');
            })
            .catch((error) => {
                console.error('Error capturing screenshot:', error);
            });
    }, [mediaStream]);

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
                            <p>Click I agree below to confirm that you understand these instructions.</p>
                        </div>
                        <button
                            className="agree-button"
                            onClick={() => {
                                requestScreenCapture(); // Request screen sharing permission
                            }}
                        >
                            I Agree
                        </button>
                    </div>
                </div>
            )}

            {/* Permission Error Dialog */}
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

            {/* Warning Popup */}
            {showWarning && (
                <div className="popup-overlay">
                    <div className="popup">
                        <h2>Warning</h2>
                        <p>You have violated the test rules. Please do not switch tabs or minimize the browser again.</p>
                        <button
                            className="close-button"
                            onClick={() => {
                                setShowWarning(false); // Close the warning popup
                                if (isScreenSharingStopped) {
                                    requestScreenCapture(); // Restart screen sharing only if the warning is due to screen sharing being stopped
                                    setIsScreenSharingStopped(false); // Reset the flag
                                }
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Google Form Page */}
            {submitted ? (
                googleFormBlocked ? (
                    <div className="blocked-message">
                        <h2>{isTimeOver ? 'Time Over' : 'Access to the Google Form has been blocked!'}</h2>
                        <p>
                            {isTimeOver
                                ? 'Your time is over. Please try again later.'
                                : 'You moved away from the page or stopped screen sharing. Please refresh to try again.'}
                        </p>
                    </div>
                ) : (
                    <div className="success-message">
                        <div className="google-form-container" ref={googleFormRef}>
                            <div className="timer-container">
                                <p className="custom-timer">Time remaining: {Math.floor(timer / 60)}:{timer % 60}</p>
                            </div>
                            <iframe
                                src="https://docs.google.com/forms/d/e/1FAIpQLSdjoWcHb2PqK1BXPp_U8Z-AYHyaimZ4Ko5-xvmNOOuQquDOTQ/viewform?embedded=true"
                                className="google-form-iframe"
                                title="Google Form"
                            >
                                Loading…
                            </iframe>
                            {/* Display the number of violations for debugging or user information */}
                            <p className="violations-info">Violations: {violations}</p>
                        </div>
                    </div>
                )
            ) : (
                // Details Form Page
                <form className="form-card" onSubmit={handleSubmit}>
                    <h2>Submit Your Details</h2>
                    <div className="form-group">
                        <label>Name:</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => checkFieldExists('name', name, setNameError)} // Validate name on blur
                            required
                        />
                        {nameError && <p className={`error-message ${nameError ? 'visible' : ''}`}>{nameError || ''}</p>}
                    </div>
                    <div className="form-group">
                        <label>Email:</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => checkFieldExists('email', email, setEmailError)} // Validate email on blur
                            required
                        />
                        {emailError && <p className={`error-message ${emailError ? 'visible' : ''}`}>{emailError || ''}</p>}
                    </div>
                    <div className="form-group">
                        <label>Phone Number:</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onBlur={() => checkFieldExists('phone', phone, setPhoneError)} // Validate phone on blur
                            required
                        />
                        {phoneError && <p className={`error-message ${phoneError ? 'visible' : ''}`}>{phoneError || ''}</p>}
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" className="submit-button">
                        Submit
                    </button>
                </form>
            )}
        </div>
    );
};

export default Form;