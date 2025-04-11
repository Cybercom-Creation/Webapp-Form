import React, { useState, useEffect } from 'react';
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
    const [timer, setTimer] = useState(600); // Timer in seconds
    const [isTimeOver, setIsTimeOver] = useState(false); // State to track if the timer is over
    const [violations, setViolations] = useState(0); // Track the number of violations

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

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

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
                                setShowInstructions(false);
                                setSubmitted(true); // Redirect to the Google Form page
                            }}
                        >
                            I Agree
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
                            onClick={() => setShowWarning(false)} // Close the warning popup
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
                                : 'You moved away from the page. Please refresh to try again.'}
                        </p>
                    </div>
                ) : (
                    <div className="success-message">
                        <div className="google-form-container">
                            <div className="timer-container">
                                <p className="custom-timer">Time remaining: {formatTime(timer)}</p>
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