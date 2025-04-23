// backend/src/models/ProctoringLog.js
const mongoose = require('mongoose');

const ProctoringLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to the User document
        ref: 'User', // Links to the 'User' model
        required: true,
        index: true, // Add index for faster lookups by userId
    },
    triggerEvent: {
        type: String,
        required: true,
        enum: [ // Define allowed event types
            'no_face',
            'multiple_face',
            'tab_switch',
            'screenshare_stop',
            'high_noise',
            'unknown_warning' // Add any other events you log
        ],
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
        required: true,
    },
    // You could add duration here if calculated on the backend
    // durationMs: { type: Number }
});

module.exports = mongoose.model('ProctoringLog', ProctoringLogSchema); // Collection: 'proctoringlogs'
