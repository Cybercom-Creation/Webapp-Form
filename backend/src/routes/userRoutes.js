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
        // 3. Construct SQL Query (Looks OK)
        const sql = `SELECT ${field} FROM users WHERE ${field} = ? LIMIT 1`;
        console.log(`Executing SQL: ${sql} with value: ${value}`); // Check Render logs for this!

        // 4. *** Execute Query - MOST LIKELY POINT OF FAILURE FOR 500 ***
        const [results] = await db.query(sql, [value]); // <--- Suspect Area

        // 5. Check Results and Send Response (OK if query succeeds)
        if (results.length > 0) {
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            return res.status(409).json({ message: `User with this ${fieldName} already exists.` });
        } else {
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            return res.status(200).json({ message: `${fieldName} is available.` });
        }
    } catch (dbError) {
        // 6. Handle Errors (This catch block is being triggered)
        console.error(`Database error in /check-field (Field: ${field}, Value: ${value}):`, dbError); // Check Render logs for this!
        const err = new Error(`Failed to check ${field} availability due to a server error.`);
        err.statusCode = 500; // Sets the 500 status
        next(err); // Passes to the central error handler
    }
});

module.exports = router;