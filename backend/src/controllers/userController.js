const db = require('../utils/db');

class UserController {
  constructor(db) {
    this.db = db;
  }

  async checkUserExists(email) {
    try {
      const [rows] = await this.db.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('DB error in checkUserExists:', error);
      const err = new Error('Database error checking user existence.');
      err.statusCode = 500;
      throw err;
    }
  }

  async createUser(userData) {
    const { name, email, phone } = userData;

    if (!name || !email || !phone) {
      const error = new Error('All fields are required.');
      error.statusCode = 400;
      throw error;
    }

    const userExists = await this.checkUserExists(email);
    if (userExists) {
      const error = new Error('User with this email already exists.');
      error.statusCode = 409;
      throw error;
    }

    try {
      const [result] = await this.db.query(
        'INSERT INTO users (name, email, phone) VALUES (?, ?, ?)',
        [name, email, phone]
      );
      return {
        id: result.insertId,
        name,
        email,
        phone
      };
    } catch (error) {
      console.error('DB error in createUser:', error);
      const err = new Error('Database error during user creation.');
      err.statusCode = 500;
      throw err;
    }
  }
}

module.exports = UserController;