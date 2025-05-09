// backend/src/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true, // Ensure emails are unique
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true, // Ensure phone numbers are unique
        trim: true,
        // Add validation if needed, e.g., length or regex
        // match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    photoBase64: { // Store the initial photo captured during registration
        type: String, // Base64 data is a string
        required: false,
    },
    photoDriveLink: { type: String },
    // --- NEW FIELDS ---
    driveFolderId: { type: String }, // Store the Google Drive Folder ID
    driveFolderLink: { type: String }, // Store the web link to the folder
    testStartTime: { type: Date }, // For Feature 3
    testEndTime: { type: Date },   // For Feature 3
    testDurationMs: { type: Number }, // For Feature 3 (Optional, can be calculated)
    // --- END NEW FIELDS ---
     // --- New fields for Google Form Submission ---
    formSubmitted: {
        type: Boolean,
        default: false
    },
    formSubmissionTimestamp: { type: Date },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    
});

// Optional virtuals (keep as is)
UserSchema.virtual('testDurationMinutes').get(function() {
    if (this.testStartTime && this.testEndTime) {
      const durationMs = this.testEndTime.getTime() - this.testStartTime.getTime();
      return Math.round(durationMs / (1000 * 60));
    }
    return null;
  });
  UserSchema.set('toJSON', { virtuals: true });
  UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema); // 'User' will be the collection name (pluralized to 'users')
// Note: Mongoose will automatically pluralize the model name to create the collection name in MongoDB