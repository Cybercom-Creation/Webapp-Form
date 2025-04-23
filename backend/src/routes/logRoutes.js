const express = require('express');
const router = express.Router();
const ProctoringLog = require('../models/ProctoringLog');
// Optional: Import User model if you want to validate userId exists
// const User = require('../models/User');

// --- POST /api/proctoring-logs ---
// Save a new proctoring log
router.post('/', async (req, res) => {
    try {
        const { userId, triggerEvent, startTime, endTime } = req.body;

        if (!userId || !triggerEvent || !startTime || !endTime) {
            return res.status(400).json({ message: 'Missing required fields for proctoring log' });
        }

        // Optional: Validate if the userId actually corresponds to a user
        // const userExists = await User.findById(userId);
        // if (!userExists) {
        //     return res.status(404).json({ message: `User with ID ${userId} not found.` });
        // }

        const newLog = new ProctoringLog({
            userId,
            triggerEvent,
            startTime: new Date(startTime), // Ensure dates are stored as Date objects
            endTime: new Date(endTime)      // Ensure dates are stored as Date objects
        });

        await newLog.save();
        res.status(201).json({ message: 'Proctoring log saved successfully' });

    } catch (error) {
        console.error("Error saving proctoring log:", error);
         if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error saving proctoring log' });
    }
});

module.exports = router;
