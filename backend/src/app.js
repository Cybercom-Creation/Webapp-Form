// backend/server.js (or app.js)
require('dotenv').config(); // Load environment variables FIRST
const express = require('express');
const cors = require('cors');
const connectDB = require('./utils/db'); // Adjust path if needed

// Connect to Database
connectDB();

const app = express();

app.use(cors({
    origin: 'https://webapp-form-frontend.onrender.com', // your frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // or '*' for all
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for images/screenshots
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// --- Define Routes ---
// Example: Assuming you have route files
app.use('/api/users', require('./routes/userRoutes')); // Example path
app.use('/api/proctoring-logs', require('./routes/logRoutes')); // Example path
app.use('/api/screenshots', require('./routes/screenshotRoutes')); // Example path

// --- Basic Error Handling (Example) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
