const db = require('../utils/db');

class UserController {
    constructor(db) {
        this.db = db;
    }
 
    //  // Refactored createUser method
    //  async createUser(userData) { // Accepts user data object
    //     const { name, email, phone } = userData; // Destructure from the input object
 
    //     // --- Input Validation ---
    //     if (!name || !email || !phone) {
    //         // Throw an error instead of sending response
    //         const error = new Error('All fields (name, email, phone) are required.');
    //         error.statusCode = 400; // Add status code for the route handler
    //         throw error;
    //     }
 
    //     // --- Check if User Exists ---
    //     const userExists = await this.checkUserExists(email);
    //     if (userExists) {
    //         const error = new Error('User with this email already exists.');
    //         error.statusCode = 409; // Conflict status
    //         throw error;
    //     }



    // Refactored createUser method
    async createUser(userData) { // Accepts user data object
        // Destructure photoBase64 along with other fields
        const { name, email, phone, photoBase64 } = userData;

        // --- Input Validation ---
        // Add photoBase64 to the check if it becomes mandatory
        if (!name || !email || !phone /* || !photoBase64 */) {
            const error = new Error('All fields (name, email, phone) are required.'); // Adjust message if photo is required
            error.statusCode = 400;
            throw error;
        }
        // Optional: Add basic validation for photoBase64 (e.g., is it a non-empty string?)
        if (photoBase64 && typeof photoBase64 !== 'string') {
             const error = new Error('Invalid photo data format.');
             error.statusCode = 400;
             throw error;
        }


        // --- Check if User Exists ---
        const userExists = await this.checkUserExists(email);
        if (userExists) {
            const error = new Error('User with this email already exists.');
            error.statusCode = 409; // Conflict status
            throw error;
        }
 
    //     // --- Database Insertion ---
    //     // Use Promise wrapper for db.query if it doesn't return promises natively
    //     return new Promise((resolve, reject) => {
    //         const query = 'INSERT INTO users (name, email, phone) VALUES (?, ?, ?)';
    //         this.db.query(query, [name, email, phone], (error, results) => {
    //             if (error) {
    //                 console.error('Database error during user creation:', error);
    //                 // Create a generic server error
    //                 const dbError = new Error('Database error during user creation.');
    //                 dbError.statusCode = 500;
    //                 return reject(dbError);
    //             }
    //             // Check if insertId is available
    //             if (results && results.insertId) {
    //                 // Resolve with the newly created user object (or just the ID)
    //                 resolve({ id: results.insertId, name, email, phone });
    //             } else {
    //                 // Handle case where insertion might succeed but ID isn't returned
    //                 console.error('User created, but insertId not found in results.');
    //                 const idError = new Error('User created, but failed to retrieve ID.');
    //                 idError.statusCode = 500; // Treat as server error
    //                 reject(idError);
    //             }
    //         });
    //     });
    // }


 // --- New Database Insertion ---
        return new Promise((resolve, reject) => {
            // Add the photo_base64 column to the query
            const query = 'INSERT INTO users (name, email, phone, photo_base64) VALUES (?, ?, ?, ?)';
            // Add photoBase64 to the parameters array
            this.db.query(query, [name, email, phone, photoBase64 || null], (error, results) => { // Use null if photoBase64 is empty/undefined
                if (error) {
                    console.error('Database error during user creation:', error);
                    const dbError = new Error('Database error during user creation.');
                    dbError.statusCode = 500;
                    return reject(dbError);
                }
                if (results && results.insertId) {
                    // Resolve with the ID and basic info
                    resolve({ id: results.insertId, name, email, phone });
                } else {
                    console.error('User created, but insertId not found in results.');
                    const idError = new Error('User created, but failed to retrieve ID.');
                    idError.statusCode = 500;
                    reject(idError);
                }
            });
        });
    }
 
    // checkUserExists remains the same (returns a Promise)
    async checkUserExists(email) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM users WHERE email = ?';
            this.db.query(query, [email], (error, results) => {
                if (error) {
                    // Reject with a proper error object
                    const dbError = new Error('Database error checking user existence.');
                    dbError.statusCode = 500;
                    return reject(dbError);
                }
                resolve(results.length > 0);
            });
        });
    }
}
module.exports = UserController;