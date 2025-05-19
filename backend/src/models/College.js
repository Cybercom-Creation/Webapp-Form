// backend/src/models/College.js
const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'College name is required.'],
        trim: true,
        unique: true, // Ensures college names are unique in this collection
    },
    // You could add other fields like 'location', 'type', etc. in the future
}, { timestamps: true });

module.exports = mongoose.model('College', CollegeSchema);