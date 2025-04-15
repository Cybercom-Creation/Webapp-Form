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



// check-field route remains the same...
router.post('/check-field', async (req, res) => {
    // ... (keep existing implementation) ...
     const { field, value } = req.body;

    if (!field || !value) {
        return res.status(400).json({ message: 'Field and value are required.' });
    }

    // --- IMPORTANT SECURITY NOTE for check-field ---
    // Directly injecting `field` into the SQL query is vulnerable to SQL Injection
    // if the frontend could somehow send arbitrary field names.
    // It's safer to validate the `field` parameter against a list of allowed fields.
    const allowedFields = ['name', 'email', 'phone']; // Example allowed fields
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ message: 'Invalid field specified for checking.' });
    }
    // --- End Security Note ---


    try {
        // Use placeholder for field name safely (if your DB driver supports it)
        // Or construct query carefully after validation
        const query = `SELECT * FROM users WHERE \`${field}\` = ?`; // Use backticks for field name

        // Using Promise wrapper for consistency
        const results = await new Promise((resolve, reject) => {
             db.query(query, [value], (err, results) => {
                if (err) {
                    console.error(`Database error checking field ${field}:`, err);
                    const dbError = new Error('Database error checking field.');
                    dbError.statusCode = 500;
                    return reject(dbError);
                }
                resolve(results);
            });
        });

        if (results.length > 0) {
            return res.status(409).json({ message: `${field} already exists.` });
        }
        res.status(200).json({ message: `${field} is available.` });

    } catch (error) {
         console.error(`Error in POST /api/users/check-field route:`, error);
         const statusCode = error.statusCode || 500;
         res.status(statusCode).json({ message: error.message || `Error checking ${field}.` });
    }
});

module.exports = router;