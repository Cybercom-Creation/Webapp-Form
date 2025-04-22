const express = require('express');
const router = express.Router();
const Screenshot = require('../models/Screenshot');
// Optional: Import User model if you want to validate userId exists
// const User = require('../models/User');

// --- POST /api/screenshots ---
// Save a new screenshot
router.post('/', async (req, res) => {
    try {
        const { userId, screenshot } = req.body;

        if (!userId || !screenshot) {
            return res.status(400).json({ message: 'Missing userId or screenshot data' });
        }

        // Optional: Validate user exists
        // const userExists = await User.findById(userId);
        // if (!userExists) {
        //     return res.status(404).json({ message: `User with ID ${userId} not found.` });
        // }

        const newScreenshot = new Screenshot({ userId, screenshot });
        await newScreenshot.save();

        res.status(201).json({ message: 'Screenshot saved successfully' });

    } catch (error) {
        console.error("Error saving screenshot:", error);
         if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error saving screenshot' });
    }
});

module.exports = router;
