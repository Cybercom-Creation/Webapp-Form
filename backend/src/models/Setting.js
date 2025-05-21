// backend/src/models/Setting.js
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    identifier: {
        type: String,
        default: 'global_settings',
        unique: true,
        required: true,
    },
    liveVideoStreamEnabled: {
        type: Boolean,
        default: false,
    },
    noiseDetectionEnabled: {
        type: Boolean,
        default: false,
    },
    userPhotoFeatureEnabled: {
        type: Boolean,
        default: false,
    },
    periodicScreenshotsEnabled: {
        type: Boolean,
        default: false,
    },
    screenshotIntervalSeconds: {
        type: Number,
        default: 300, // Default to 5 minutes
    },
    testDurationInterval: { // New field for test duration
        type: Number,
        default: 10, // Default to 60 minutes
        min: 5,      // Minimum test duration (e.g., 5 minutes)
    },
    googleFormLink: { // New field for the Google Form link
        type: String,
        trim: true,
        default: '', // Default to an empty string, admin will set this
    },
}, { timestamps: true }); // Add timestamps to know when settings were last updated

settingSchema.statics.findOrCreate = async function findOrCreate() {
    let settings = await this.findOne({ identifier: 'global_settings' });
    if (!settings) {
        settings = await this.create({ identifier: 'global_settings' });
        console.log('Created default application settings.');
    }
    return settings;
};

//const Setting = mongoose.model('Setting', settingSchema);
const Setting = mongoose.model('Setting', settingSchema, 'appsettings');

module.exports = Setting;