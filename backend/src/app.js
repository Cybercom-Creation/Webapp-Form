const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import CORS
const fs = require('fs'); // File system module for saving files
const path = require('path'); // Path module for handling file paths
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Enable CORS

// Configure body-parser with a larger limit
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for JSON payloads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // Increase limit for URL-encoded payloads

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