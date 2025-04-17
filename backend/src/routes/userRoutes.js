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
router.post('/check-field', async (req, res, next) => { // Added next
    const { field, value } = req.body;

    // 1. Basic Input Validation
    if (!field || !value) {
        // Send 400 if required fields are missing
        return res.status(400).json({ message: 'Both "field" and "value" are required.' });
    }

    // 2. *** SECURITY FIX: Whitelist allowed fields ***
    const allowedFields = ['name', 'email', 'phone']; // Add any other fields you allow checking
    if (!allowedFields.includes(field)) {
        // Send 400 if the field is not allowed for checking
        return res.status(400).json({ message: `Checking for field "${field}" is not permitted.` });
    }

    try {
        // 3. *** CORRECTED & SAFE QUERY CONSTRUCTION ***
        // Use the validated field name directly in the query string (since it's whitelisted)
        // Use a placeholder (?) for the value to prevent SQL injection
        // Select only '1' or the field itself for efficiency if you only need existence
        const sql = `SELECT ${field} FROM users WHERE ${field} = ? LIMIT 1`;
        console.log(`Executing SQL: ${sql} with value: ${value}`); // For debugging backend logs

        // 4. Execute Query using await (assuming db.query returns a promise - common with mysql2/promise)
        const [results] = await db.query(sql, [value]);

        // 5. Check Results and Send Response
        if (results.length > 0) {
            // Field value exists - Conflict (409)
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1); // Capitalize for message
            return res.status(409).json({ message: `User with this ${fieldName} already exists.` });
        } else {
            // Field value is available - Success (200)
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            return res.status(200).json({ message: `${fieldName} is available.` });
        }
    } catch (dbError) {
        // 6. Handle Database or Other Errors
        console.error(`Database error in /check-field (Field: ${field}, Value: ${value}):`, dbError);
        // Pass a generic server error to the central handler
        const err = new Error(`Failed to check ${field} availability due to a server error.`);
        err.statusCode = 500;
        next(err); // Pass to central error handler
    }
});

module.exports = router;