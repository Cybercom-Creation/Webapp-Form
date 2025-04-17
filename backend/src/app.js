require('dotenv').config();
const db = require('./utils/db');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import CORS
const fs = require('fs'); // File system module for saving files
const path = require('path'); // Path module for handling file paths
const userRoutes = require('./routes/userRoutes');
// const envPath = path.resolve(__dirname, '.env');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// app.use(cors({
//     origin: 'https://webapp-form-frontend.onrender.com/', // your frontend
//     methods: ['GET', 'POST', 'PUT', 'DELETE'], // or '*' for all
//     credentials: true
//   }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://webapp-form-frontend.onrender.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });
  

// Configure body-parser with a larger limit
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for JSON payloads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // Increase limit for URL-encoded payloads

// --- NEW ENDPOINT for Proctoring Logs ---
app.post('/api/proctoring-logs', async (req, res) => {
    const { userId, triggerEvent, startTime, endTime } = req.body;
 
    // Basic Validation
    if (!userId || !triggerEvent || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required log data fields.' });
    }
 
    try {
        // Convert JS timestamps (milliseconds) to SQL DATETIME format
        const startDateTime = new Date(startTime).toISOString().slice(0, 19).replace('T', ' ');
        const endDateTime = new Date(endTime).toISOString().slice(0, 19).replace('T', ' ');
 
        const sql = `
            INSERT INTO proctoring_logs
            (user_id, trigger_event, warning_start_time, warning_end_time)
            VALUES (?, ?, ?, ?)
        `;
 
        // --- Wrap db.query in a Promise if it's callback-based ---
        await new Promise((resolve, reject) => {
            db.query(sql, [userId, triggerEvent, startDateTime, endDateTime], (error, results) => {
                if (error) {
                    // Reject the promise with the database error
                    return reject(error); // Pass the actual error object
                }
                // Resolve the promise on successful insertion
                resolve(results);
            });
        });
        // --- End Promise Wrapper ---
 
        console.log(`Proctoring log saved for users ${userId}, event: ${triggerEvent}`);
        res.status(201).json({ message: 'Proctoring log saved successfully.' });
 
    } catch (error) {
        // This catch block will now receive errors from the Promise reject
        console.error('Error saving proctoring log:', error); // Log the actual DB error
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(400).json({ message: 'Invalid user ID provided.' });
        }
        // Send a more specific error message if possible, otherwise generic
        // Use error.message if available from the rejected promise
        res.status(500).json({ message: `Failed to save proctoring log: ${error.message || 'Unknown database error'}` });
    }
});
// --- End New Endpoint ---

// User routes
app.use('/api/users', userRoutes);

// Endpoint to save screenshots
app.post('/api/screenshots', (req, res) => {
    const { screenshot } = req.body;

    if (!screenshot) {
        return res.status(400).json({ message: 'Screenshot is required' });
    }

    // Decode the base64 image
    const base64Data = screenshot.replace(/^data:image\/png;base64,/, '');

    // Generate a unique filename
    const filename = `screenshot_${Date.now()}.png`;

    // Define the directory to save the screenshots
    const screenshotsDir = path.join(__dirname, 'screenshots');

    // Ensure the directory exists
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    // Save the screenshot as a file
    const filePath = path.join(screenshotsDir, filename);
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error('Error saving screenshot:', err);
            return res.status(500).json({ message: 'Failed to save screenshot' });
        }

        console.log(`Screenshot saved successfully at ${filePath}`);
        res.status(200).json({ message: 'Screenshot saved successfully', filePath });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});