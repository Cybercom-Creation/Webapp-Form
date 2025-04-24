const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import the User model

// *** Import the Google Drive upload function ***
const { uploadProfilePhotoToDrive } = require('../Services/googleDriveService'); // Adjust path if needed


// --- POST /api/users ---
// Create a new user
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, photoBase64 } = req.body;

        // Basic validation (Mongoose schema handles more)
        if (!name || !email || !phone || !photoBase64) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Optional: More specific validation for photoBase64 if provided
        if (photoBase64 && typeof photoBase64 !== 'string') {
            return res.status(400).json({ message: 'Invalid photo data format.' });
       }
       if (photoBase64 && !photoBase64.startsWith('data:image/jpeg;base64,')) {
            console.warn('[Routes] Received photoBase64 does not start with "data:image/jpeg;base64,"');
            // Decide if this is an error or just a warning
            // return res.status(400).json({ message: 'Photo data must be a Base64 encoded JPEG.' });
       }

        // Mongoose handles unique checks via schema index, but explicit check is fine too
        let existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            // Determine which field caused the conflict for a better message
            let conflictField = existingUser.email === email ? 'Email' : 'Phone number';
            return res.status(409).json({ message: `${conflictField} already exists.` });
        }


        // --- Upload Photo to Google Drive ---
        let photoDriveLink = null; // Initialize link as null
        if (photoBase64) { // Only attempt upload if photo data exists
            try {
                // Generate a filename (use user's name or email for folder, specific name for file)
                const safeUserNameForFolder = name.replace(/[^a-zA-Z0-9\s_-]/g, '_'); // Basic sanitization
                const fileName = `profile_${Date.now()}.jpg`; // Unique filename

                console.log(`[Routes] Attempting to upload photo for user ${email} (folder: ${safeUserNameForFolder}) as ${fileName}`);

                // *** Call the service function ***
                const driveFileData = await uploadProfilePhotoToDrive(safeUserNameForFolder, photoBase64, fileName);

                if (driveFileData && driveFileData.link) {
                    photoDriveLink = driveFileData.link; // Store the link if upload succeeded
                    console.log(`[Routes] Successfully uploaded photo to Drive. Link: ${photoDriveLink}`);
                } else {
                    console.warn(`[Routes] Failed to upload profile photo to Drive for user ${email}. Proceeding without Drive link.`);
                }
            } catch (uploadError) {
                console.error("[Routes] Error during profile photo upload:", uploadError.message || uploadError);
                // Log the error and proceed without the link (photoDriveLink remains null)
                // Optionally, you could return an error to the user here if the upload is critical
                // return res.status(500).json({ message: 'Failed to upload profile photo.' });
            }
        } else {
            console.log(`[Routes] No photo data provided for user ${email}. Skipping Drive upload.`);
        }

         // --- Create New User Document ---
        const newUser = new User({
            name,
            email,
            phone,
            photoBase64: photoBase64 || null, // Save original base64 or null
            photoDriveLink: photoDriveLink    // Save the drive link (or null if failed/not provided)
            // createdAt will be added automatically by Mongoose if defined in schema
        });

        // Save the new user document to MongoDB
        await newUser.save(); // Save the new user document

        // IMPORTANT: Send back the MongoDB _id as userId for the frontend
        res.status(201).json({ message: 'User created successfully', userId: newUser._id });

    } catch (error) {
        console.error("User creation error:", error);
        if (error.code === 11000) { // Handle Mongoose duplicate key error
            // Determine which field caused the error (more advanced)
            let field = Object.keys(error.keyValue)[0];
            field = field.charAt(0).toUpperCase() + field.slice(1); // Capitalize
            return res.status(409).json({ message: `${field} already exists.` });
        }
        if (error.name === 'ValidationError') {
            // Extract validation messages
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error during user creation' });
    }
});

// --- POST /api/users/check-field ---
// Check if email or phone exists
router.post('/check-field', async (req, res) => {
    try {
        const { field, value } = req.body;

        // Validate input
        if (!field || !value || !['name', 'email', 'phone'].includes(field)) {
            return res.status(400).json({ message: 'Invalid field specified for check' });
        }

        const query = {};
        query[field] = value; // Build query dynamically: { email: 'test@example.com' } or { phone: '1234567890' }

        const existingUser = await User.findOne(query);

        if (existingUser) {
            // Use 409 Conflict status code to indicate existence
            return res.status(409).json({ exists: true, message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.` });
        } else {
            // Use 200 OK to indicate availability
            return res.status(200).json({ exists: false, message: `${field} is available.` });
        }
    } catch (error) {
        console.error(`Error checking field ${field}:`, error);
        res.status(500).json({ message: 'Server error checking field availability' });
    }
});

module.exports = router;
