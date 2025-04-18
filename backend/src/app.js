require('dotenv').config();
const pool = require('./utils/db');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import CORS
//const fs = require('fs'); // File system module for saving files
const path = require('path'); // Path module for handling file paths
const userRoutes = require('./routes/userRoutes');
const db = require('./utils/db'); // Adjust path as needed
const envPath = path.resolve(__dirname, '.env');
const { uploadScreenshotToDrive } = require('./Services/googleDriveService'); // Import the service

require('dotenv').config({ path: envPath });
 

const app = express();
const PORT = process.env.PORT || 5000;


// app.use(morgan('dev'));

app.use(cors());

// app.options('*', cors()); // <- Handles preflight requests (OPTIONS)

// app.use((req, res, next) => {
//     console.log('Origin:', req.headers.origin);
//     next();
//   });
  

// Configure body-parser with a larger limit
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for JSON payloads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // Increase limit for URL-encoded payloads

// --- New Endpoint for Proctoring Logs ---
app.post('/api/proctoring-logs', async (req, res) => {
    // Remove violationCount from destructuring
    const { userId, triggerEvent, startTime, endTime } = req.body;

    // Basic Validation (remove violationCount check)
    if (!userId || !triggerEvent || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required log data fields (userId, triggerEvent, startTime, endTime).' });
    }

    try {
        // Convert JS timestamps (milliseconds) to SQL DATETIME format
        const startDateTime = new Date(startTime).toISOString().slice(0, 19).replace('T', ' ');
        const endDateTime = new Date(endTime).toISOString().slice(0, 19).replace('T', ' ');

        // --- Calculate interval in seconds ---
        const intervalMs = endTime - startTime;
        const intervalSeconds = Math.round(intervalMs / 1000); // Calculate duration
        // --- End Calculation ---


        // --- Update SQL Query ---
        const sql = `
            INSERT INTO proctoring_logs
            (user_id, trigger_event, warning_start_time, warning_end_time, interval_seconds)
            VALUES (?, ?, ?, ?, ?)
        `;
        // --- End Update SQL Query ---

        await new Promise((resolve, reject) => {
            // --- Update Parameters ---
            db.query(sql, [userId, triggerEvent, startDateTime, endDateTime, intervalSeconds], (error, results) => {
            // --- End Update Parameters ---
                if (error) {
                    return reject(error);
                }
                resolve(results);
            });
        });

        console.log(`Proctoring log saved for user ${userId}, event: ${triggerEvent}, interval: ${intervalSeconds}s`); // Updated log
        res.status(201).json({ message: 'Proctoring log saved successfully.' });

    } catch (error) {
        console.error('Error saving proctoring log:', error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(400).json({ message: 'Invalid user ID provided.' });
        }
        res.status(500).json({ message: `Failed to save proctoring log: ${error.message || 'Unknown database error'}` });
    }
});
// --- End Endpoint ---

// User routes
app.use('/api/users', userRoutes);

app.use((err, req, res, next) => {
    console.error("Central Error Handler:", err.stack); // Log the full error stack
    const statusCode = err.statusCode || 500; // Use status code from error if available
    res.status(statusCode).json({
      message: err.message || 'An unexpected server error occurred.',
      // Optionally add more details in development
      // error: process.env.NODE_ENV === 'development' ? err : {}
    });
  });

  app.get('/api/db-test', async (req, res, next) => {
    try {
        const [results] = await db.query('SELECT 1 as test');
        res.status(200).json({ message: 'Database connection successful!', results: results });
    } catch (error) {
        console.error("DB Test Error:", error);
        res.status(500).json({ message: 'Database connection failed!', error: error.message });
        // Or use next(error) if you want the central handler
    }
});


// --- UPDATED Endpoint to save screenshots to Google Drive ---
app.post('/api/screenshots', async (req, res) => {
    const { screenshot, userId } = req.body;
 
    if (!screenshot || !userId) {
        return res.status(400).json({ message: 'Screenshot data and userId are required.' });
    }
 
    try {
        // 1. Look up user name from the database using userId
        const user = await new Promise((resolve, reject) => {
            console.log(`[Screenshots API] Attempting to fetch name for userId: ${userId}`);
            // --- CORRECTED QUERY: Use 'user_id' instead of 'id' ---
            db.query('SELECT name FROM users WHERE user_id = ?', [userId], (err, results) => {
            // --- END CORRECTION ---
                if (err) {
                    console.error('[Screenshots API] Database query error fetching user name:', err);
                    return reject(new Error('Database error fetching user name.'));
                }
                if (results.length === 0) {
                    console.warn(`[Screenshots API] User not found for userId: ${userId}`);
                    return reject(new Error(`User with ID ${userId} not found.`));
                }
                console.log(`[Screenshots API] User found:`, results[0]);
                resolve(results[0]);
            });
        });
 
        if (!user || !user.name) {
             return res.status(404).json({ message: `User with ID ${userId} not found or has no name.` });
        }
 
        const userName = user.name;
 
        // 2. Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `screenshot_${userName}_${timestamp}.png`;
 
        // 3. Call Google Drive upload service
        console.log(`[Screenshots API] Calling uploadScreenshotToDrive for user: ${userName}, filename: ${filename}`);
        const fileId = await uploadScreenshotToDrive(userName, screenshot, filename);
 
        // 4. Send success response
        res.status(200).json({
            message: 'Screenshot uploaded successfully to Google Drive.',
            driveFileId: fileId,
            fileName: filename
        });
 
    } catch (error) {
        console.error('[Screenshots API] Error processing screenshot upload:', error);
        res.status(500).json({ message: `Failed to upload screenshot: ${error.message}` });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});