const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import the User model
const College = require('../models/College'); // <<< IMPORT THE COLLEGE MODEL
const Setting = require('../models/Setting'); // Assuming you have this model

// *** Import the Google Drive upload function ***
const { uploadProfilePhotoToDrive, getUserDriveFolderDetails } = require('../Services/googleDriveService'); // Adjust path if needed


// --- POST /api/users ---
// Create a new user
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, photoBase64, collegeName } = req.body;

        // Fetch current application settings
        const appSettings = await Setting.findOne({ identifier: 'global_settings' });

        // // Conditionally require photoBase64 based on settings
        // if (appSettings && appSettings.userPhotoFeatureEnabled) {
        //     if (!photoBase64) {
        //         return res.status(400).json({ message: 'User photo is required because the photo feature is enabled.' });
        //     }
        // }

        // Basic validation (Mongoose schema handles more)
        if (!name || !email || !phone ) {
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



        // --- 1. Get/Create the Nested User Drive Folder Structure ---
        // This will now return { id: userSpecificFolderId, link: userSpecificFolderLink, collegeDriveFolderId: collegeFolderId }
        let userDriveFolderDetails = { id: null, link: null, collegeDriveFolderId: null };
        const shouldCreateDriveFolder = appSettings && (appSettings.userPhotoFeatureEnabled || appSettings.periodicScreenshotsEnabled);
        if (shouldCreateDriveFolder) {
            try {
                console.log(`[Routes] Getting/Creating Drive folder structure for user: ${name}, college: ${collegeName || 'N/A'}`);
                // Pass both name (as userName) and collegeName
                userDriveFolderDetails = await getUserDriveFolderDetails(name, collegeName || 'DefaultCollege'); // Provide a fallback for collegeName if it can be undefined
                if (userDriveFolderDetails && userDriveFolderDetails.id) {
                    console.log(`[Routes] User-specific Drive Folder ID: ${userDriveFolderDetails.id}, Link: ${userDriveFolderDetails.link}, College Drive Folder ID: ${userDriveFolderDetails.collegeDriveFolderId}`);
                } else {
                    console.warn(`[Routes] Failed to get user Drive folder details for user ${name}. Proceeding without full folder info.`);
                    userDriveFolderDetails = { id: null, link: null, collegeDriveFolderId: null }; // Ensure reset
                }
            } catch (folderError) {
                console.error('[Routes] Google Drive user folder creation/retrieval failed:', folderError);
                userDriveFolderDetails = { id: null, link: null, collegeDriveFolderId: null }; // Ensure reset on error
                // Decide if this is critical. For now, proceed but log.
            }
        }
        else {
            console.log(`[Routes] Skipping Drive folder creation for user: ${name} as no relevant features (userPhoto, screenshot) are enabled.`);
        }
        // --- End Folder Creation ---

        // --- Handle College Name ---
        let collegeId = null;
        let collegeDocument = null; // To store the fetched/created college document
        if (collegeName && collegeName.trim() !== '') {
            const trimmedCollegeName = collegeName.trim();
            try {
                let college = await College.findOne({ name: trimmedCollegeName });
                if (!college) {
                    // College not found, create it
                    console.log(`[Routes] College "${trimmedCollegeName}" not found, creating new one.`);
                    college = new College({ name: trimmedCollegeName });
                    // If we have a collegeDriveFolderId from userDriveFolderDetails, assign it now
                    if (userDriveFolderDetails && userDriveFolderDetails.collegeDriveFolderId) {
                        college.driveFolderId = userDriveFolderDetails.collegeDriveFolderId;
                        console.log(`[Routes] Assigning Drive Folder ID ${userDriveFolderDetails.collegeDriveFolderId} to new college "${trimmedCollegeName}".`);
                    }
                    await college.save();
                    console.log(`[Routes] College "${trimmedCollegeName}" created with ID: ${college._id}`);
                } else {
                    console.log(`[Routes] College "${trimmedCollegeName}" found with ID: ${college._id}`);
                    // If college exists and doesn't have a driveFolderId, but we got one, update it
                    if (!college.driveFolderId && userDriveFolderDetails && userDriveFolderDetails.collegeDriveFolderId) {
                        college.driveFolderId = userDriveFolderDetails.collegeDriveFolderId;
                        await college.save();
                        console.log(`[Routes] Updated existing college "${trimmedCollegeName}" with Drive Folder ID ${userDriveFolderDetails.collegeDriveFolderId}.`);
                    }
                }
                collegeId = college._id;
                collegeDocument = college; // Store the document
            } catch (collegeError) {
                console.error('[Routes] Error finding or creating college:', collegeError);
                // Optional: Decide if user creation should fail if college processing fails.
                // For now, we'll log the error and proceed without associating a college.
                // If college is critical, you might return an error:
                // return res.status(500).json({ message: 'Error processing college information.' });
            }
        }
        // --- End Handle College Name ---



        // --- Upload Photo to Google Drive ---
        let photoUploadResult = { id: null, link: null };
        if (photoBase64 && userDriveFolderDetails && userDriveFolderDetails.id) { // Only attempt upload if photo data and user's folder ID exist
            try {
                
                const fileName = `profile_${Date.now()}.jpg`; // Unique filename

                console.log(`[Routes] Attempting to upload photo for user ${email} to folder ${userDriveFolderDetails.id} as ${fileName}`);
                // --- END FIX ---

              // Store the object result here
              photoUploadResult = await uploadProfilePhotoToDrive(userDriveFolderDetails.id, photoBase64, fileName);

             // --- FIX: Correct console log to show the actual link ---
             if (photoUploadResult && photoUploadResult.link) {
                console.log(`[Routes] Successfully uploaded photo to Drive. Link: ${photoUploadResult.link}`); // Log the .link property
            } else {
                console.warn(`[Routes] Failed to upload profile photo to Drive for user ${email}. Proceeding without Drive link.`);
                photoUploadResult = { id: null, link: null }; // Reset on failure
            }
                
            } catch (uploadError) {
                console.error("[Routes] Error during profile photo upload:", uploadError.message || uploadError);
                photoDriveLink = { id: null, link: null };
                // Log the error and proceed without the link (photoDriveLink remains null)
                // Optionally, you could return an error to the user here if the upload is critical
                // return res.status(500).json({ message: 'Failed to upload profile photo.' });
            }
        } else {
            console.log(`[Routes] No photo data provided for user ${email}. Skipping Drive upload.`);
        }

        // // --- Create New User Document ---
        // const newUser = new User({
        //     name,
        //     email,
        //     phone,
        //     photoBase64: photoBase64 || null, // Save original base64 or null
        //     photoDriveLink: photoUploadResult.link,   // Save the drive link (or null if failed/not provided)
        //     driveFolderId: userDriveFolder.id,       // <-- SAVE FOLDER ID
        //     driveFolderLink: userDriveFolder.link, // <-- SAVE FOLDER LINK

        //     // createdAt will be added automatically by Mongoose if defined in schema
        // });

        const newUserDetails = { name, email, phone };
        if (photoBase64) { // Only add photoBase64 if it was provided
            newUserDetails.photoBase64 = photoBase64;
        }

        // Add Drive details to the user object
        newUserDetails.driveFolderId = userDriveFolderDetails.id; // This is the user's specific folder ID
        newUserDetails.driveFolderLink = userDriveFolderDetails.link; // This is the user's specific folder link
        if (photoUploadResult && photoUploadResult.link) {
            newUserDetails.photoDriveLink = photoUploadResult.link;
        }

        if (collegeId) { // Add collegeId if it was processed
            newUserDetails.college = collegeId;
        }

        const newUser = new User(newUserDetails);
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



// PATCH /api/users/:userId/start-test - Mark test start time
router.patch('/:userId/start-test', async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Only set start time if it hasn't been set already
        if (!user.testStartTime) {
            user.testStartTime = new Date();


            await user.save();

             // --- ADD LOGGING AFTER SAVE ---
             try {
                await user.save();
                console.log(`[Start Test Route] Successfully saved start time for user ${userId}`); // <-- ADD THIS
            } catch (saveError) {
                console.error(`[Start Test Route] Error saving user after setting start time for ${userId}:`, saveError); // <-- ADD THIS
                // Decide if you should return an error to the client here
                return res.status(500).json({ message: 'Failed to save test start time.' });
            }
            // --- END LOGGING ---
            console.log(`Test start time marked for user ${userId} at ${user.testStartTime}`);
            res.status(200).json({ message: 'Test start time recorded.', testStartTime: user.testStartTime });
        } else {
            console.log(`Test start time already recorded for user ${userId}.`);
            res.status(200).json({ message: 'Test start time was already recorded.', testStartTime: user.testStartTime });
        }

    } catch (error) {
        console.error(`Error marking test start for user ${userId}:`, error);
         if (error.name === 'CastError') {
             return res.status(400).json({ message: 'Invalid userId format.' });
         }
        res.status(500).json({ message: 'Server error marking test start time.' });
    }
});

// PATCH /api/users/:userId/end-test - Mark test end time and calculate duration
router.patch('/:userId/end-test', async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Only set end time if start time exists and end time hasn't been set
        if (user.testStartTime && !user.testEndTime) {
            user.testEndTime = new Date();

            

            // Calculate and store duration in milliseconds
            user.testDurationMs = user.testEndTime.getTime() - user.testStartTime.getTime();

            await user.save();
            // --- ADD LOGGING AFTER SAVE ---
            try {
                await user.save();
                console.log(`[End Test Route] Successfully saved end time and duration (${user.testDurationMs}ms) for user ${userId}`); // <-- ADD THIS
            } catch (saveError) {
                console.error(`[End Test Route] Error saving user after setting end time/duration for ${userId}:`, saveError); // <-- ADD THIS
                return res.status(500).json({ message: 'Failed to save test end time and duration.' });
            }
            // --- END LOGGING ---

            console.log(`Test end time marked for user ${userId} at ${user.testEndTime}. Duration: ${user.testDurationMs}ms`);
            res.status(200).json({
                message: 'Test end time recorded.',
                testEndTime: user.testEndTime,
                testDurationMs: user.testDurationMs
            });
        } else if (!user.testStartTime) {
             console.log(`Cannot mark end time for user ${userId}: Start time not recorded.`);
             res.status(400).json({ message: 'Test start time was never recorded.' });
        } else {
            console.log(`Test end time already recorded for user ${userId}.`);
            res.status(200).json({
                message: 'Test end time was already recorded.',
                testEndTime: user.testEndTime,
                testDurationMs: user.testDurationMs
             });
        }

    } catch (error) {
        console.error(`Error marking test end for user ${userId}:`, error);
         if (error.name === 'CastError') {
             return res.status(400).json({ message: 'Invalid userId format.' });
         }
        res.status(500).json({ message: 'Server error marking test end time.' });
    }
});



// --- NEW: POST route specifically for beforeunload beacon ---
router.post('/:userId/beacon-end-test', async (req, res) => {
    const { userId } = req.params;
    console.log(`[Beacon] Received request to end test for user ${userId}`); // Log beacon reception

    try {
        const user = await User.findById(userId);
        // Check if user exists and test hasn't already ended
        if (!user) {
            // Don't send 404, as beacon doesn't process responses. Just log.
            console.log(`[Beacon] User not found: ${userId}`);
            return res.status(204).send(); // Send No Content, success but nothing to return
        }
        if (user.testEndTime) {
            console.log(`[Beacon] Test already ended for user: ${userId}`);
            return res.status(204).send();
        }
        if (!user.testStartTime) {
            console.log(`[Beacon] Test start time not recorded for user: ${userId}. Cannot mark end.`);
            return res.status(204).send(); // Or maybe 400 if you could process it
        }

        // --- Same logic as PATCH /end-test ---
        user.testEndTime = new Date(); // Record current time as end time
        user.testDurationMs = user.testEndTime.getTime() - user.testStartTime.getTime();
        await user.save();

        // --- ADD LOGGING AFTER SAVE ---
        try {
            await user.save();
            console.log(`[Beacon] Successfully saved end time and duration (${user.testDurationMs}ms) for user ${userId}`); // <-- ADD THIS
        } catch (saveError) {
            console.error(`[Beacon] Error saving user after setting end time/duration for ${userId}:`, saveError); // <-- ADD THIS
            // Can't send error response to beacon, but log it
        }
        // --- END LOGGING ---

        // --- End same logic ---

        console.log(`[Beacon] Successfully marked end time for user ${userId} at ${user.testEndTime}. Duration: ${user.testDurationMs}ms`);
        res.status(204).send(); // Beacon expects success codes (2xx), 204 is appropriate

    } catch (error) {
        // Log errors, but beacon won't see the response
        console.error(`[Beacon] Error marking test end for user ${userId}:`, error);
        // Still send a success-like status if possible, otherwise let it fail
        res.status(204).send(); // Or potentially 500, though client won't see it
    }
});

module.exports = router;
