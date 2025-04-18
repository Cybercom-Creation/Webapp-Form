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

// --- Upload Screenshot ---
const uploadScreenshotToDrive = async (userName, base64Data, fileName) => {
    if (!userName || !base64Data || !fileName) {
        throw new Error('User name, base64 data, and file name are required for upload.');
    }

    try {
        const drive = await authenticate();

        // 1. Find or create the main folder. Don't share this one explicitly here,
        // assuming it's already shared correctly with the service account.
        console.log(`[Drive Service] Step 1: Finding/Creating main folder '${MAIN_FOLDER_NAME}'...`);
        const mainFolderId = await findOrCreateFolder(drive, MAIN_FOLDER_NAME, 'root', false); // shareWithUser = false
        console.log(`[Drive Service] Main folder ID determined as: ${mainFolderId}`);

        // 2. Find or create the user-specific folder inside the main folder
        // *** Share this user folder with the target user ***
        console.log(`[Drive Service] Step 2: Finding/Creating user folder '${userName}' inside '${mainFolderId}'...`);
        const userFolderId = await findOrCreateFolder(drive, userName, mainFolderId, true); // shareWithUser = true
        console.log(`[Drive Service] User folder ID determined as: ${userFolderId}`);

        // 3. Prepare file metadata and media content
        const fileMetadata = {
            name: fileName,
            parents: [userFolderId],
        };

        const base64Image = base64Data.split(';base64,').pop();
        if (!base64Image) { throw new Error('Invalid base64 data format.'); }

        const buffer = Buffer.from(base64Image, 'base64');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        const media = { mimeType: 'image/png', body: bufferStream };

        // 4. Upload the file
        console.log(`[Drive Service] Step 3: Uploading '${fileName}' to user folder ID: ${userFolderId}...`);
        const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name',
        });

        const uploadedFileId = uploadedFile.data.id;
        console.log(`[Drive Service] File '${uploadedFile.data.name}' uploaded successfully with ID: ${uploadedFileId}`);

        // Optional: Explicitly share the individual file too? Usually sharing the folder is enough.
        // await addEditorPermission(drive, uploadedFileId, TARGET_USER_EMAIL);

        return uploadedFileId;

    } catch (error) {
        console.error(`[Drive Service] Error uploading screenshot '${fileName}' for user '${userName}':`, error);
        throw new Error(`Failed to upload screenshot to Google Drive: ${error.message}`);
    }
};

module.exports = {
    uploadScreenshotToDrive,
};