// c:\Users\Keyur Parmar\ProjectUsingAITool\Webapp-Form\backend\src\routes\screenshotRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import the User model to find user names
// const Screenshot = require('../models/Screenshot'); // No longer saving screenshot data directly to MongoDB here

// --- IMPORTANT ---
// You need to implement and import the Google Drive upload function
// Assuming it's in a service file like this:
// const { uploadScreenshotToDrive } = require('../services/googleDriveService');
// Make sure the 'uploadScreenshotToDrive' function exists and handles errors appropriately.
// It should likely take (userName, base64ScreenshotData, filename) as arguments
// and return the Google Drive file ID.
// Replace the line below with your actual import:
const { uploadScreenshotToDrive } = require('../Services/googleDriveService'); // <--- ADD YOUR ACTUAL IMPORT HERE
const { file } = require('googleapis/build/src/apis/file');

// --- POST /api/screenshots ---
// Receives screenshot data and userId, looks up user name, uploads to Google Drive
router.post('/', async (req, res) => {
    // 1. Extract data from request body
    // Make sure the frontend sends 'screenshotData' and 'userId'
    const { screenshotData, userId } = req.body; // Renamed 'screenshot' to 'screenshotData' for clarity

    // 2. Validate required data
    if (!screenshotData) {
        // Use the key name expected from the frontend
        return res.status(400).json({ message: 'Missing screenshotData field.' });
    }
    if (!userId) {
        return res.status(400).json({ message: 'Missing userId field.' });
    }
    let driveUploadDetails;

    try {
        // 3. Look up user name from the database using userId (Mongoose)
        console.log(`[Screenshots API] Attempting to fetch user for userId: ${userId}`);
        // Find the user by their MongoDB _id and select only the 'name' field
        const user = await User.findById(userId).select('driveFolderId name email');

        if (!user) {
            console.warn(`[Screenshots API] User not found for userId: ${userId}`);
            return res.status(404).json({ message: `User with ID ${userId} not found.` });
        }
        if (!user.driveFolderId) {
            console.error(`User ${userId} does not have a screenshotFolderId.`);
            return res.status(500).json({ message: 'Screenshot folder configuration missing for this user.' });
        }

        // Ensure the user object has a name property
        if (!user.name) {
            console.warn(`[Screenshots API] User with ID ${userId} found but has no name field.`);
            return res.status(404).json({ message: `User with ID ${userId} found but has no name.` });
        }
       
        const userName = user.name;
        const userDriveFolderId = user.driveFolderId;
        
        console.log(`[Screenshots API] User found: ${userName}. Uploading to Folder ID: ${userDriveFolderId}`);
        // --- END FIX ---


        // 4. Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Replace characters invalid for filenames
        const filename = `screenshot_${userName.replace(/\s+/g, '_')}_${timestamp}.png`; // Replace spaces in username for filename


        // 3. Call Google Drive upload service
        console.log(`[Screenshots API] Calling uploadScreenshotToDrive for user: ${userName}, filename: ${filename}`);
        driveUploadDetails = await uploadScreenshotToDrive(userDriveFolderId, screenshotData, filename); // Assign result
        console.log(`[Screenshots API] Google Drive upload successful. File ID: ${driveUploadDetails.id}, Link: ${driveUploadDetails.link}`);

        // //let driveUploadDetails;
        // try {
        //     //driveUploadDetails = await uploadScreenshotToDrive(screenshotData, user.screenshotFolderId, fileName);
        //     const driveUploadDetails = await uploadScreenshotToDrive(userName, userIdentifier, screenshotData, filename);
        // } catch (uploadError) {
        //     console.error(`Failed to upload screenshot to Drive for user ${userId}:`, uploadError);
        //     // Decide how to handle: save log without link? Return error?
        //     return res.status(500).json({ message: 'Failed to upload screenshot to Google Drive.' });
        // }

        // Save screenshot metadata to MongoDB (optional, but good practice)
        // You might want to store the Drive link/ID here too
        // const newScreenshotLog = new Screenshot({
        //     userId: userId,
           
        //     screenshotDriveId: driveUploadDetails.id, // Store Drive ID
        //     screenshotDriveLink: driveUploadDetails.link, // Store Drive Link
        //     // capturedAt is set by default
        // });
        // await newScreenshotLog.save();

        //console.log(`Screenshot metadata saved for user ${userId}, Drive ID: ${driveUploadDetails.id}`);
        res.status(201).json({
            message: 'Screenshot uploaded and logged successfully',
            driveFileId: driveUploadDetails.id,
            driveLink: driveUploadDetails.link,
            fileName: filename
        });


        // // 5. Call Google Drive upload service
        // // Pass the actual base64 data (screenshotData)
        // console.log(`[Screenshots API] Calling uploadScreenshotToDrive for user: ${userName}, filename: ${filename}`);
        // const fileId = await uploadScreenshotToDrive(userName, screenshotData, filename);
        // console.log(`[Screenshots API] Google Drive upload successful. File ID: ${fileId}`);

        // // 6. Send success response
        // res.status(200).json({
        //     message: 'Screenshot uploaded successfully to Google Drive.',
        //     driveFileId: fileId,
        //     fileName: filename
        // });

    } catch (error) {
        console.error('[Screenshots API] Error processing screenshot upload:', error);

        // Handle specific Mongoose errors if needed
        if (error.name === 'CastError') {
             return res.status(400).json({ message: `Invalid user ID format: ${userId}` });
        }

        // Handle errors potentially thrown by uploadScreenshotToDrive or other issues
        // Use the error message if available, otherwise provide a generic one
        res.status(500).json({ message: `Failed to upload screenshot: ${error.message || 'Internal Server Error'}` });
    }
});

module.exports = router;
