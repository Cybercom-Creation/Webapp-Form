import React from 'react';

const SuccessMessage = () => {
    return (
        <div>
            <h2>Thank you for submitting your details!</h2>
            <p>Your information has been successfully recorded.</p>
            <a href="https://forms.gle/your-google-form-link" target="_blank" rel="noopener noreferrer">
                Click here to fill out the Google Form
            </a>
        </div>
    );
};

export default SuccessMessage;