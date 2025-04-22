const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import the User model

// --- POST /api/users ---
// Create a new user
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, photoBase64 } = req.body;

        // Basic validation (Mongoose schema handles more)
        if (!name || !email || !phone || !photoBase64) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Mongoose handles unique checks via schema index, but explicit check is fine too
        let existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(409).json({ message: 'Email or phone number already exists.' });
        }

        const newUser = new User({ name, email, phone, photoBase64 });
        await newUser.save(); // Save the new user document

        // IMPORTANT: Send back the MongoDB _id as userId for the frontend
        res.status(201).json({ message: 'User created successfully', userId: newUser._id });

    } catch (error) {
        console.error("User creation error:", error);
        if (error.code === 11000) { // Handle Mongoose duplicate key error
            // Determine which field caused the error (more advanced)
            let field = Object.keys(error.keyValue)[0];
            field = field.charAt(0).toUpperCase() + field.slice(1); // Capitalize
            return res.status(409).json({ message: `${field} already exists.` });
        }
        if (error.name === 'ValidationError') {
            // Extract validation messages
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error during user creation' });
    }
});

// --- POST /api/users/check-field ---
// Check if email or phone exists
router.post('/check-field', async (req, res) => {
    try {
        const { field, value } = req.body;

        // Validate input
        if (!field || !value || !['name', 'email', 'phone'].includes(field)) {
            return res.status(400).json({ message: 'Invalid field specified for check' });
        }

        const query = {};
        query[field] = value; // Build query dynamically: { email: 'test@example.com' } or { phone: '1234567890' }

        const existingUser = await User.findOne(query);

        if (existingUser) {
            // Use 409 Conflict status code to indicate existence
            return res.status(409).json({ exists: true, message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.` });
        } else {
            // Use 200 OK to indicate availability
            return res.status(200).json({ exists: false, message: `${field} is available.` });
        }
    } catch (error) {
        console.error(`Error checking field ${field}:`, error);
        res.status(500).json({ message: 'Server error checking field availability' });
    }
});

module.exports = router;
