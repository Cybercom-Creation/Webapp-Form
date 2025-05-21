// backend/src/models/College.js
const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'College name is required.'],
        trim: true,
        unique: true, // Ensures college names are unique in this collection
    },
    driveFolderId: { // ID of the Google Drive folder for this college
        type: String,
        sparse: true, // Optional: use if not all colleges will immediately have a Drive folder
    }
    // You could add other fields like 'location', 'type', etc. in the future
}, { timestamps: true });

module.exports = mongoose.model('College', CollegeSchema);