// backend/src/routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting'); // Adjust path if needed

// GET /api/settings - Fetch current application settings
// This endpoint is for your client web-app
router.get('/', async (req, res) => {
    try {
        // Assuming a single global settings document, identified by a specific field or just the first one.
        // Using the findOrCreate static method from the model
        // const settings = await Setting.findOrCreate();
        // if (!settings) {
        //     // This case should ideally be handled by findOrCreate creating defaults
        //     return res.status(404).json({ msg: 'Settings not found and defaults could not be created.' });
        // }
        const settingsDoc = await Setting.findOrCreate(); // This should always return a document or throw
        // The Setting.findOrCreate() method is designed to always return a settings document.
        const settings = settingsDoc.toObject(); // Convert to a plain JS object

        // Ensure googleFormLink is part of the response, defaulting to empty string if not set.
        // This handles cases where an old document (pre-dating this field) is fetched.
        if (typeof settings.googleFormLink === 'undefined') {
            settings.googleFormLink = ''; // Default to empty string as per schema
        }

        res.json(settings);
    } catch (err) {
        console.error('Error fetching settings:', err.message);
        // Send back the default structure on error, so client doesn't break
        // Or, let the client handle defaults as per its existing logic
        res.status(500).json({
            liveVideoStreamEnabled: false,
            noiseDetectionEnabled: false,
            userPhotoFeatureEnabled: false,
            periodicScreenshotsEnabled: false,
            screenshotIntervalSeconds: 300,
            testDurationInterval: 10, // Default to 10 minutes
            googleFormLink: '', // Default googleFormLink
            error: 'Server error while fetching settings'
        });
    }
});

// PATCH /api/settings - Update application settings
// This endpoint would be used by your admin panel
router.patch('/', async (req, res) => {
    // Optional: Add authentication/authorization middleware here to protect this route
    // e.g., ensure only admins can update settings.
    const {
        liveVideoStreamEnabled,
        noiseDetectionEnabled,
        userPhotoFeatureEnabled,
        periodicScreenshotsEnabled,
        screenshotIntervalSeconds,
        testDurationInterval,
        googleFormLink // Add googleFormLink here
    } = req.body;

    const settingsFields = {};
    if (liveVideoStreamEnabled !== undefined) settingsFields.liveVideoStreamEnabled = liveVideoStreamEnabled;
    if (noiseDetectionEnabled !== undefined) settingsFields.noiseDetectionEnabled = noiseDetectionEnabled;
    if (userPhotoFeatureEnabled !== undefined) settingsFields.userPhotoFeatureEnabled = userPhotoFeatureEnabled;
    if (periodicScreenshotsEnabled !== undefined) settingsFields.periodicScreenshotsEnabled = periodicScreenshotsEnabled;
    if (screenshotIntervalSeconds !== undefined) settingsFields.screenshotIntervalSeconds = screenshotIntervalSeconds;
    if (testDurationInterval !== undefined) settingsFields.testDurationInterval = Number(testDurationInterval);
    if (googleFormLink !== undefined) settingsFields.googleFormLink = googleFormLink; // Add to settingsFields
    console.log('Admin Panel PATCH /api/settings - Constructed settingsFields to update:', settingsFields); // <--- ADD THIS
    

    try {
        let settings = await Setting.findOneAndUpdate(
            { identifier: 'global_settings' }, // Find the global settings document
            { $set: settingsFields },
            { new: true, upsert: true, runValidators: true } // Create if doesn't exist, return updated, run schema validations
        );
        if (!settings) {
            // This case should ideally be handled by upsert: true creating the document
            // if it doesn't exist. If it's still null, something is wrong.
             console.warn('Settings document not found or created after findOneAndUpdate with upsert.');
             // Attempt to create it explicitly if findOneAndUpdate with upsert didn't work as expected
             // This is a fallback, ideally upsert should handle it.
             settings = await Setting.create({ identifier: 'global_settings', ...settingsFields });
             if (!settings) {
                return res.status(404).json({ msg: 'Settings not found and could not be created.' });
             }
        }

        console.log('Admin Panel PATCH /api/settings - MongoDB update result:', settings); // <--- ADD THIS
        res.json(settings);
    } catch (err) {
        console.error('Error updating settings:', err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/settings/google-form-link - Fetch the Google Form link
// This endpoint is for your candidate-facing web-app
router.get('/google-form-link', async (req, res) => {
    try {
        const settings = await Setting.findOrCreate(); // Ensures settings doc exists
        if (settings && settings.googleFormLink && settings.googleFormLink.trim() !== '') {
            res.json({ success: true, link: settings.googleFormLink });
        } else {
            // It's better to send a 200 OK with success: false if the setting is simply not configured,
            // rather than a 404, as the settings resource itself exists.
            res.json({ success: false, message: 'Google Form link not configured.' });
        }
    } catch (error) {
        console.error('Error fetching Google Form link:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve Google Form link.' });
    }
});

// PUT /api/settings/google-form-link - Update the Google Form link
// This endpoint is for your admin panel
// Using PUT here as it's specifically for updating/replacing this particular setting.
// You could also merge this logic into the main PATCH /api/settings endpoint if preferred.
router.put('/google-form-link', async (req, res) => {
    // Optional: Add authentication/authorization middleware here
    const { googleFormLink } = req.body;

    if (typeof googleFormLink !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid Google Form link provided. It must be a string.' });
    }

    try {
        const settings = await Setting.findOneAndUpdate(
            { identifier: 'global_settings' }, // Assuming you use this identifier
            { $set: { googleFormLink: googleFormLink.trim() } },
            { new: true, upsert: true, runValidators: true }
        );
        res.json({ success: true, message: 'Google Form link updated successfully.', settings });
    } catch (error) {
        console.error('Error updating Google Form link:', error);
        res.status(500).json({ success: false, message: 'Failed to update Google Form link.' });
    }
});

module.exports = router;