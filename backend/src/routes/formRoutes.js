const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import User model to update user status

// --- POST /api/form/submitted ---
// Handles the webhook notification from Google Apps Script upon form submission
router.post('/submitted', async (req, res) => {
    console.log('Received Google Form submission notification:');
    console.log('Request Body:', req.body); // Log the entire payload from Apps Script

    // Extract expected data from the payload
    // Use default values (like null) if a field might be missing
    const {
        timestamp = new Date().toISOString(), // Use received timestamp or fallback
        respondentEmail = null,
        userId = null // This should be the MongoDB _id from the form
    } = req.body;

    console.log(`Submission Timestamp: ${timestamp}`);
    console.log(`Respondent Email: ${respondentEmail}`);
    console.log(`User ID (from form): ${userId}`);

    // --- Backend logic to update user status ---
    if (userId) {
        try {
            // Validate if userId looks like a MongoDB ObjectId before querying
            if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
                 console.warn(`Received userId "${userId}" is not a valid MongoDB ObjectId format.`);
                 // Decide how to handle this - maybe still log, but don't query DB?
                 // For now, we'll proceed, but Mongoose might throw a CastError later
            }

            // Find the user by the MongoDB _id passed via the pre-filled form link
            const user = await User.findById(userId);

            if (user) {
                // Check if the form hasn't already been marked as submitted
                if (!user.formSubmitted) {
                    user.formSubmitted = true; // Update the flag in your User schema
                    user.formSubmissionTimestamp = new Date(timestamp); // Store the submission timestamp
                    // Optionally store the respondent email if needed
                    // user.formRespondentEmail = respondentEmail; // Add this field to schema if needed

                    await user.save();
                    console.log(`Successfully marked form as submitted for user ID: ${userId}`);
                } else {
                    console.log(`Form was already marked as submitted for user ID: ${userId}. Ignoring duplicate notification.`);
                }
            } else {
                console.warn(`Form submission notification received, but User ID "${userId}" was not found in the database.`);
                // This could happen if the ID was incorrect or the user was deleted
            }
        } catch (error) {
            console.error(`Error processing form submission notification for User ID "${userId}":`, error);
            // If it's a CastError, the userId format was likely invalid
            if (error.name === 'CastError') {
                 console.error(`Invalid userId format received: ${userId}`);
                 // Send a 400 Bad Request back to Apps Script? Might not be necessary.
                 return res.status(400).json({ message: `Invalid userId format: ${userId}` });
            }
            // For other errors, send a generic server error
            // Note: Google Apps Script might not do much with this error response, but it's good practice
            return res.status(500).json({ message: 'Internal server error processing form submission.' });
        }
    } else {
        console.warn("Form submission notification received, but no userId was provided in the payload. Cannot update user status.");
        // You might want to log the respondentEmail here for manual matching if needed
    }

    // Send a success response back to Google Apps Script to acknowledge receipt
    // This should be sent even if the userId wasn't found or was already processed,
    // unless a critical server error occurred (handled above).
    res.status(200).json({ message: 'Notification received successfully by backend.' });
});

module.exports = router;

