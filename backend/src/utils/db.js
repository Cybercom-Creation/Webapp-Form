const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '.env');

require('dotenv').config({ path: envPath });

const caPath = path.resolve(__dirname, 'ca.pem');

const mysql = require('mysql2');

// --- Read the CA certificate file ---
let sslConfig;
try {
    const caCert = fs.readFileSync(caPath); // <-- Read the file content
    sslConfig = {
        rejectUnauthorized: true, // Keep this true for security
        ca: caCert // <-- Provide the CA certificate content
    };
} catch (err) {
    console.error(`Error reading CA certificate from ${caPath}:`, err);
    console.error("Database connection will likely fail without the CA certificate.");
    // Fallback or decide how to handle missing CA cert (e.g., exit)
    sslConfig = { rejectUnauthorized: true }; // Attempt connection without custom CA (will likely fail as before)
}

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslConfig
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

module.exports = db;