// src/services/googleDriveService.js
const { google } = require('googleapis');
const path = require('path');
const stream = require('stream');

// --- Configuration ---
const KEY_FILE_PATH = path.join(__dirname, '../service-account-key.json'); // Verify this path again
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const MAIN_FOLDER_NAME = 'Test'; // <<< MAKE SURE THIS MATCHES YOUR DRIVE FOLDER'S CASING EXACTLY
const TARGET_USER_EMAIL = 'devansh@cybercomcreation.com'; // <<< Your email address


// --- Authentication ---
const authenticate = async () => {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: SCOPES,
        });
        const authClient = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: authClient });
        console.log('[Drive Service] Google Drive authentication successful.');
        return drive;
    } catch (error) {
        console.error('[Drive Service] Error authenticating with Google Drive:', error);
        throw new Error('Google Drive authentication failed.');
    }
};

// --- Add Permission ---
/**
 * Adds edit permission for a specific user to a file/folder.
 * @param {object} drive - Authenticated Google Drive API client.
 * @param {string} fileId - The ID of the file or folder to share.
 * @param {string} userEmail - The email address of the user to grant permission to.
 */
const addEditorPermission = async (drive, fileId, userEmail) => {
    console.log(`[Drive Service] Adding editor permission for ${userEmail} to file/folder ID: ${fileId}`);
    try {
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'writer', // 'writer' role grants editor permissions
                type: 'user',
                emailAddress: userEmail,
            },
            // Set sendNotificationEmail to false if you don't want an email notification
            // sendNotificationEmail: false,
        });
        console.log(`[Drive Service] Successfully added editor permission for ${userEmail} to ${fileId}.`);
    } catch (error) {
        // Log the error but don't necessarily stop the whole upload process
        // It might fail if permission already exists or due to other sharing policies
        console.error(`[Drive Service] Warning: Failed to add editor permission for ${userEmail} to ${fileId}. Error:`, error.response ? error.response.data : error.message);
        // You might want to check for specific error codes, e.g., if permission already exists
    }
};


// --- Find or Create Folder ---
const findOrCreateFolder = async (drive, folderName, parentFolderId, shareWithUser = false) => { // Added shareWithUser flag
    const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
    console.log(`[Drive Service] Searching for folder: Name='${folderName}', ParentID='${parentFolderId}'`);
    try {
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (response.data.files && response.data.files.length > 0) {
            const foundId = response.data.files[0].id;
            console.log(`[Drive Service] Folder '${folderName}' found with ID: ${foundId}`);
            // Even if found, ensure the target user has permission (optional, but good practice)
            if (shareWithUser && TARGET_USER_EMAIL) {
                 await addEditorPermission(drive, foundId, TARGET_USER_EMAIL);
            }
            return foundId;
        } else {
            console.log(`[Drive Service] Folder '${folderName}' not found in parent '${parentFolderId}'. Creating...`);
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId],
            };
            const createdFolder = await drive.files.create({
                resource: fileMetadata,
                fields: 'id',
            });
            const createdId = createdFolder.data.id;
            console.log(`[Drive Service] Folder '${folderName}' created with ID: ${createdId}`);
            // Share the newly created folder
            if (shareWithUser && TARGET_USER_EMAIL) {
                await addEditorPermission(drive, createdId, TARGET_USER_EMAIL);
            }
            return createdId;
        }
    } catch (error) {
        console.error(`[Drive Service] Error finding or creating folder '${folderName}' in parent '${parentFolderId}':`, error.response ? error.response.data : error.message);
        throw new Error(`Failed to find or create folder '${folderName}'. Ensure service account has permissions on parent folder ID: ${parentFolderId}.`);
    }
};


// --- NEW: Get SINGLE User Folder Details ---
/**
 * Finds or creates the user's single dedicated folder (named after username) and returns its ID and webViewLink.
 * @param {string} userName - The user's name (used for folder naming).
 * @returns {Promise<{id: string, link: string}>} - The ID and webViewLink of the user's folder.
 */
const getUserDriveFolderDetails = async (userName) => {
    if (!userName) {
        throw new Error('User name is required to get user Drive folder details.');
    }
    // Sanitize username for folder name
    const userFolderName = userName.replace(/[^a-zA-Z0-9\s_-]/g, '_');

    try {
        const drive = await authenticate();

        // 1. Find/Create Main Folder ('Test')
        console.log(`[Drive Service - User Folder] Step 1: Finding/Creating main folder '${MAIN_FOLDER_NAME}'...`);
        const mainFolderId = await findOrCreateFolder(drive, MAIN_FOLDER_NAME, 'root', false);
        console.log(`[Drive Service - User Folder] Main folder ID: ${mainFolderId}`);

        // 2. Find/Create the SINGLE User Folder (named userName) inside the main folder
        console.log(`[Drive Service - User Folder] Step 2: Finding/Creating user folder '${userFolderName}' inside '${mainFolderId}'...`);
        const userFolderId = await findOrCreateFolder(drive, userFolderName, mainFolderId, true); // Share with TARGET_USER_EMAIL
        console.log(`[Drive Service - User Folder] User folder ID: ${userFolderId}`);

        // 3. Get the webViewLink for the user folder
        console.log(`[Drive Service - User Folder] Step 3: Fetching webViewLink for folder ID: ${userFolderId}...`);
        const folderDetails = await drive.files.get({ fileId: userFolderId, fields: 'webViewLink' });
        const folderLink = folderDetails.data.webViewLink;

        if (!folderLink) console.warn(`[Drive Service - User Folder] Could not retrieve webViewLink for folder ID: ${userFolderId}`);
        else console.log(`[Drive Service - User Folder] User folder link: ${folderLink}`);

        return { id: userFolderId, link: folderLink || null }; // Return ID and Link

    } catch (error) {
        console.error(`[Drive Service - User Folder] Error getting folder details for user '${userName}':`, error);
        throw new Error(`Failed to get user Drive folder details: ${error.message}`);
    }
};



// --- MODIFIED: Upload Screenshot ---
/**
 * Uploads a screenshot to the specified user's Google Drive folder.
 * @param {string} userFolderId - The ID of the user's dedicated Drive folder.
 * @param {string} base64Data - The base64 encoded screenshot data (e.g., from canvas.toDataURL()).
 * @param {string} fileName - The desired filename for the screenshot.
 * @returns {Promise<{id: string, link: string}>} - The ID and webViewLink of the uploaded screenshot file.
 */
const uploadScreenshotToDrive = async (userFolderId, base64Data, fileName) => {
    // Validate inputs
    if (!userFolderId || !base64Data || !fileName) {
        throw new Error('User folder ID, base64 data, and file name are required for screenshot upload.');
    }
    if (!base64Data.startsWith('data:image/')) {
         console.warn('[Drive Service - Screenshot] base64Data does not start with "data:image/".');
    }

    try {
        const drive = await authenticate();

        // --- Folder creation is now handled BEFORE calling this function ---

        // 1. Prepare file metadata and media content
        const fileMetadata = {
            name: fileName,
            parents: [userFolderId], // <<< Use the provided userFolderId
        };

        const match = base64Data.match(/^data:(image\/\w+);base64,(.*)$/);
        if (!match || match.length !== 3) throw new Error('Invalid base64 data format.');
        const mimeType = match[1];
        const base64Image = match[2];

        const buffer = Buffer.from(base64Image, 'base64');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        const media = { mimeType: mimeType, body: bufferStream };

        // 2. Upload the file
        console.log(`[Drive Service - Screenshot] Uploading '${fileName}' (${mimeType}) to user folder ID: ${userFolderId}...`);
        const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink',
        });

        const uploadedFileId = uploadedFile.data.id;
        const uploadedFileLink = uploadedFile.data.webViewLink;
        console.log(`[Drive Service - Screenshot] File '${uploadedFile.data.name}' uploaded successfully. ID: ${uploadedFileId}, Link: ${uploadedFileLink}`);

        // Optional: Add specific permissions (usually folder permissions are enough)
        // await addEditorPermission(drive, uploadedFileId, TARGET_USER_EMAIL);

        return { id: uploadedFileId, link: uploadedFileLink };

    } catch (error) {
        console.error(`[Drive Service - Screenshot] Error uploading screenshot '${fileName}':`, error);
        throw new Error(`Failed to upload screenshot to Google Drive: ${error.message}`);
    }
};




// --- MODIFIED: Upload Profile Photo ---
/**
 * Uploads the profile photo to the specified user's Google Drive folder.
 * @param {string} userFolderId - The ID of the user's dedicated Drive folder.
 * @param {string} base64Data - The base64 encoded photo data (JPEG expected).
 * @param {string} fileName - The desired filename for the photo.
 * @returns {Promise<{id: string, link: string}>} - The ID and webViewLink of the uploaded photo file.
 */
const uploadProfilePhotoToDrive = async (userFolderId, base64Data, fileName) => {
    // Input validation
    if (!userFolderId || !base64Data || !fileName) {
        throw new Error('User folder ID, base64 data, and file name are required for profile photo upload.');
    }
    if (!base64Data.startsWith('data:image/jpeg;base64,')) {
        console.warn('[Drive Service - Profile Photo] base64Data does not start with "data:image/jpeg;base64,".');
    }

    try {
        const drive = await authenticate();

        // --- Folder creation is now handled BEFORE calling this function ---

        // 1. Prepare file metadata and media content
        const fileMetadata = {
            name: fileName,
            parents: [userFolderId], // <<< Use the provided userFolderId
        };

        const base64Image = base64Data.split(';base64,').pop();
        if (!base64Image) throw new Error('Invalid base64 data format.');

        const buffer = Buffer.from(base64Image, 'base64');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        const media = { mimeType: 'image/jpeg', body: bufferStream };

        // 2. Upload the file
        console.log(`[Drive Service - Profile Photo] Uploading '${fileName}' to user folder ID: ${userFolderId}...`);
        const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink',
        });

        const uploadedFileId = uploadedFile.data.id;
        const uploadedFileLink = uploadedFile.data.webViewLink;
        console.log(`[Drive Service - Profile Photo] File '${uploadedFile.data.name}' uploaded successfully. ID: ${uploadedFileId}, Link: ${uploadedFileLink}`);

        // 3. Add Public Read Permission (Keep this logic)
        try {
            console.log(`[Drive Service - Profile Photo] Setting public read permission for file ID: ${uploadedFileId}`);
            await drive.permissions.create({
                fileId: uploadedFileId,
                requestBody: { role: 'reader', type: 'anyone' },
            });
            console.log(`[Drive Service - Profile Photo] Public read permission set successfully for file ID: ${uploadedFileId}`);
        } catch (permError) {
            const errorMessage = permError.response?.data?.error?.message || permError.message;
            console.error(`[Drive Service - Profile Photo] Warning: Failed to set public read permission for file ID ${uploadedFileId}. Link might require sign-in. Error: ${errorMessage}`);
        }

        return { id: uploadedFileId, link: uploadedFileLink };

    } catch (error) {
        console.error(`[Drive Service - Profile Photo] Error uploading profile photo '${fileName}':`, error);
        throw new Error(`Failed to upload profile photo to Google Drive: ${error.message}`);
    }
};




module.exports = {
    uploadScreenshotToDrive,
    uploadProfilePhotoToDrive,
    getUserDriveFolderDetails,
};