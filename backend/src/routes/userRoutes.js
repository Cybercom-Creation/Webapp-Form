const express = require('express');
const UserController = require('../controllers/userController');
const db = require('../utils/db'); // Import the database connection

const router = express.Router();
const userController = new UserController(db); // Pass the database connection to the controller

router.post('/', async (req, res) => {
    try {
        // Now correctly calls the refactored method with user data
        const newUser = await userController.createUser(req.body);
 
        // newUser should contain { id: ..., name: ..., ... }
        res.status(201).json({
            message: 'User created successfully',
            userId: newUser.id // Send back the ID
        });
 
    } catch (error) {
        console.error('Error in POST /api/users route:', error);
        // Use statusCode from the error if available, otherwise default to 500
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ message: error.message || 'Failed to create user.' });
    }
});
router.post('/check-field', async (req, res) => {
    // ... (keep existing implementation) ...
     const { field, value } = req.body;

    // 1. Basic Input Validation (Returns 400 - OK)
    if (!field || !value) {
        return res.status(400).json({ message: 'Both "field" and "value" are required.' });
    }

    // 2. Whitelist allowed fields (Returns 400 - OK)
    const allowedFields = ['name', 'email', 'phone'];
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ message: `Checking for field "${field}" is not permitted.` });
    }

    try {
        const query = `SELECT * FROM users WHERE ${field} = ?`;
        db.query(query, [value], (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error: ' + err.message });
            }
            if (results.length > 0) {
                return res.status(409).json({ message: `${field} already exists.` });
            }
            res.status(200).json({ message: `${field} is available.` });
        });
    } catch (error) {
         console.error(`Error in POST /api/users/check-field route:`, error);
         const statusCode = error.statusCode || 500;
         res.status(statusCode).json({ message: error.message || `Error checking ${field}.` });
    }
});

module.exports = router;