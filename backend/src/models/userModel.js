const db = require('../utils/db');

const User = {
    create: (userData, callback) => {
        const { name, email, phone } = userData;
        const query = 'INSERT INTO users (name, email, phone) VALUES (?, ?, ?)';
        db.query(query, [name, email, phone], (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    },

    findByEmail: (email, callback) => {
        const query = 'SELECT * FROM users WHERE email = ?';
        db.query(query, [email], (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    },

    findByPhone: (phone, callback) => {
        const query = 'SELECT * FROM users WHERE phone = ?';
        db.query(query, [phone], (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    }
};

module.exports = User;