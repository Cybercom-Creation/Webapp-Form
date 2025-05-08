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
        const settings = await Setting.findOrCreate(); // This should always return a document or throw
        // The Setting.findOrCreate() method is designed to always return a settings document.
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
        screenshotIntervalSeconds
    } = req.body;

    const settingsFields = {};
    if (liveVideoStreamEnabled !== undefined) settingsFields.liveVideoStreamEnabled = liveVideoStreamEnabled;
    if (noiseDetectionEnabled !== undefined) settingsFields.noiseDetectionEnabled = noiseDetectionEnabled;
    if (userPhotoFeatureEnabled !== undefined) settingsFields.userPhotoFeatureEnabled = userPhotoFeatureEnabled;
    if (periodicScreenshotsEnabled !== undefined) settingsFields.periodicScreenshotsEnabled = periodicScreenshotsEnabled;
    if (screenshotIntervalSeconds !== undefined) settingsFields.screenshotIntervalSeconds = screenshotIntervalSeconds;

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

module.exports = router;