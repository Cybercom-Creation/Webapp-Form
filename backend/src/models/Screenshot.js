// backend/src/models/Screenshot.js
const mongoose = require('mongoose');

const ScreenshotSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to the User document
        ref: 'User',
        required: true,
        index: true,
    },
    screenshotData: { // Store Base64 screenshot data
        type: String,
        required: true,
    },
    capturedAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Screenshot', ScreenshotSchema); // Collection: 'screenshots'
