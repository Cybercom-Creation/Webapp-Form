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
            'looking_away',
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
    durationMs: {
        type: Number, // Store duration in milliseconds
    },
    
});

// --- Add Mongoose Pre-save Hook to Calculate Duration ---
ProctoringLogSchema.pre('save', function(next) {
    // Check if both startTime and endTime are present and are Dates
    if (this.startTime instanceof Date && this.endTime instanceof Date) {
        // Calculate duration only if not already set (or if times changed)
        if (this.isModified('startTime') || this.isModified('endTime') || !this.durationMs) {
            this.durationMs = this.endTime.getTime() - this.startTime.getTime();
        }
    } else {
        // Handle cases where dates might not be set correctly, though 'required' should prevent this
        this.durationMs = undefined; // Or null, or 0 depending on preference
    }
    next(); // Continue with the save operation
});
// --- End Pre-save Hook ---

module.exports = mongoose.model('ProctoringLog', ProctoringLogSchema); // Collection: 'proctoringlogs'
