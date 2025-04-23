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
        required: [true, 'Initial photo is required'],
    },
    photoDriveLink: { type: String },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    
});

module.exports = mongoose.model('User', UserSchema); // 'User' will be the collection name (pluralized to 'users')
