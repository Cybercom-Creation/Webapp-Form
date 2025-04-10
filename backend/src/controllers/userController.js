const db = require('../utils/db');

class UserController {
    constructor(db) {
        this.db = db;
    }

    async createUser(req, res) {
        const { name, email, phone } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        try {
            const userExists = await this.checkUserExists(email);
            if (userExists) {
                return res.status(409).json({ message: 'User already exists.' });
            }

            const query = 'INSERT INTO user (name, email, phone) VALUES (?, ?, ?)';
            this.db.query(query, [name, email, phone], (error, results) => {
                if (error) {
                    return res.status(500).json({ message: 'Database error: ' + error.message });
                }
                res.status(201).json({ message: 'User created successfully.', userId: results.insertId });
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error: ' + error.message });
        }
    }

    async checkUserExists(email) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM user WHERE email = ?';
            this.db.query(query, [email], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.length > 0);
            });
        });
    }
}

module.exports = UserController;