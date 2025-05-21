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


// --- NEW: Internal Helper - Find Folder ---
const _findDriveFolder = async (drive, name, parentId) => {
    // parentId can be an actual ID. If null/undefined, effectiveParentId becomes 'root'.
    const effectiveParentId = parentId || 'root';
    let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${effectiveParentId}' in parents`;

    console.log(`[Drive Service] _findDriveFolder: Searching for folder: Name='${name}', ParentID='${effectiveParentId}'`);
    try {
        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name, webViewLink)', // Ensure webViewLink is fetched
            spaces: 'drive',
        });
        if (res.data.files && res.data.files.length > 0) {
            console.log(`[Drive Service] _findDriveFolder: Folder '${name}' found: ID=${res.data.files[0].id}, Name='${res.data.files[0].name}'`);
            return res.data.files[0]; // Return the folder object { id, name, webViewLink }
        }
        console.log(`[Drive Service] _findDriveFolder: Folder '${name}' not found under parent '${effectiveParentId}'.`);
        return null;
    } catch (error) {
        console.error(`[Drive Service] _findDriveFolder: Error finding folder "${name}" under parent '${effectiveParentId}':`, error.response ? error.response.data : error.message);
        throw error;
    }
};

// --- NEW: Internal Helper - Create Folder ---
const _createDriveFolder = async (drive, name, parentId) => {
    // parentId can be an actual ID. If null/undefined, folder created in 'root'.
    const effectiveParentId = parentId || 'root';
    console.log(`[Drive Service] _createDriveFolder: Creating folder: Name='${name}', ParentID='${effectiveParentId}'`);
    const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) { // Only set parents if parentId is not null (i.e., not root)
        fileMetadata.parents = [parentId];
    }

    try {
        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id, name, webViewLink', // Ensure webViewLink is fetched
        });
        console.log(`[Drive Service] _createDriveFolder: Folder '${name}' created: ID=${folder.data.id}, Name='${folder.data.name}'`);
        return folder.data; // Return the new folder object { id, name, webViewLink }
    } catch (error) {
        console.error(`[Drive Service] _createDriveFolder: Error creating folder "${name}" under parent '${effectiveParentId}':`, error.response ? error.response.data : error.message);
        throw error;
    }
};

// --- REVISED: Find or Create Folder (Generic) ---
// This is a general utility. It does NOT handle sharing; sharing is a separate concern.
const findOrCreateFolder = async (drive, folderName, parentFolderId) => {
    // parentFolderId can be null/undefined for root, or an actual ID.
    const effectiveParentId = parentFolderId || 'root'; // For logging and clarity
    console.log(`[Drive Service] findOrCreateFolder: Ensuring folder: Name='${folderName}', ParentID='${effectiveParentId}'`);

    try {
        let folder = await _findDriveFolder(drive, folderName, parentFolderId);
        if (!folder) {
            console.log(`[Drive Service] findOrCreateFolder: Folder '${folderName}' not found in parent '${effectiveParentId}'. Creating...`);
            folder = await _createDriveFolder(drive, folderName, parentFolderId);
        }
        return folder; // Returns { id, name, webViewLink }
    } catch (error) {
        console.error(`[Drive Service] findOrCreateFolder: Error in find/create process for folder '${folderName}' in parent '${effectiveParentId}':`, error.message);
        throw new Error(`Failed to find or create folder '${folderName}'. Ensure service account has permissions on parent folder ID: ${effectiveParentId}. Original error: ${error.message}`);
    }
};


// --- MODIFIED: Get User Folder Details (for nested structure) ---
/**
 * Finds or creates the user's dedicated folder structure: MAIN_APP_FOLDER / College_Name / User_Name
 * and returns the ID and webViewLink of the innermost user-specific folder.
 * @param {string} userName - The user's name (used for folder naming).
 * @param {string} collegeName - The user's college name (used for the intermediate folder).
 * @param {object} [driveInstance] - Optional pre-authenticated drive instance.
 * @returns {Promise<{id: string, link: string | null, collegeDriveFolderId: string}>} - The ID and webViewLink of the user's folder, and collegeFolderId.
 */
const getUserDriveFolderDetails = async (userName, collegeName, driveInstance) => {
    if (!userName || !collegeName) {
        throw new Error('User name and college name are required to get user Drive folder details.');
    }
    // Sanitize names for folder creation
    const sanitizedUserName = (userName.replace(/[^a-zA-Z0-9\s_-]/g, '_').trim() || `user_${Date.now()}`);
    const sanitizedCollegeName = collegeName.replace(/[^a-zA-Z0-9\s_-]/g, '_').trim();

    if (!sanitizedUserName) throw new Error('Sanitized user name cannot be empty.');
    if (!sanitizedCollegeName) throw new Error('Sanitized college name cannot be empty.');

    try {
        const drive = driveInstance || await authenticate();

        // 1. Find/Create Main Application Folder (e.g., 'Test')
        console.log(`[Drive Service - User Hierarchy] Step 1: Ensuring main app folder '${MAIN_FOLDER_NAME}'...`);
        const mainAppFolder = await findOrCreateFolder(drive, MAIN_FOLDER_NAME, null); // Parent is root (null)
        if (!mainAppFolder || !mainAppFolder.id) {
            throw new Error(`Failed to find or create the main application folder: ${MAIN_FOLDER_NAME}`);
        }
        console.log(`[Drive Service - User Hierarchy] Main app folder: ID=${mainAppFolder.id}, Name='${mainAppFolder.name}'`);

        // 2. Find/Create College-Specific Folder (inside the main app folder)
        console.log(`[Drive Service - User Hierarchy] Step 2: Ensuring college folder '${sanitizedCollegeName}' inside '${mainAppFolder.name}' (ID: ${mainAppFolder.id})...`);
        const collegeFolder = await findOrCreateFolder(drive, sanitizedCollegeName, mainAppFolder.id);
        if (!collegeFolder || !collegeFolder.id) {
            throw new Error(`Failed to find or create the college folder: ${sanitizedCollegeName}`);
        }
        console.log(`[Drive Service - User Hierarchy] College folder: ID=${collegeFolder.id}, Name='${collegeFolder.name}'`);

        // 3. Share the College-Specific Folder with TARGET_USER_EMAIL (if configured)
        // This allows the target user to see the College folder in "Shared with me"
        if (TARGET_USER_EMAIL) {
            console.log(`[Drive Service - User Hierarchy] Step 3: Adding editor permission for ${TARGET_USER_EMAIL} to college folder ID: ${collegeFolder.id}`);
            await addEditorPermission(drive, collegeFolder.id, TARGET_USER_EMAIL);
        } else {
            console.log(`[Drive Service - User Hierarchy] Step 3: Skipping sharing of college folder as TARGET_USER_EMAIL is not set.`);
        }

        // 4. Find/Create User-Specific Folder (inside the college folder)
        console.log(`[Drive Service - User Hierarchy] Step 4: Ensuring user folder '${sanitizedUserName}' inside '${collegeFolder.name}' (ID: ${collegeFolder.id})...`);
        const userSpecificFolder = await findOrCreateFolder(drive, sanitizedUserName, collegeFolder.id);
        if (!userSpecificFolder || !userSpecificFolder.id) {
            throw new Error(`Failed to find or create the user-specific folder: ${sanitizedUserName}`);
        }
        console.log(`[Drive Service - User Hierarchy] User-specific folder: ID=${userSpecificFolder.id}, Name='${userSpecificFolder.name}', Link=${userSpecificFolder.webViewLink}`);

        // 5. Share the User-Specific Folder with TARGET_USER_EMAIL (if configured) - This is still useful for direct links
        if (TARGET_USER_EMAIL) {
            console.log(`[Drive Service - User Hierarchy] Step 5: Adding editor permission for ${TARGET_USER_EMAIL} to user folder ID: ${userSpecificFolder.id}`);
            await addEditorPermission(drive, userSpecificFolder.id, TARGET_USER_EMAIL);
        } else {
            console.log(`[Drive Service - User Hierarchy] Step 5: Skipping sharing of user folder as TARGET_USER_EMAIL is not set.`);
        }
        
        const folderLink = userSpecificFolder.webViewLink;
        if (!folderLink) {
            console.warn(`[Drive Service - User Hierarchy] Could not retrieve webViewLink for user folder ID: ${userSpecificFolder.id}.`);
        }

        return {
            id: userSpecificFolder.id,
            link: folderLink || null,
            collegeDriveFolderId: collegeFolder.id // Return this so caller can update College model
        };

    } catch (error) {
        console.error(`[Drive Service - User Hierarchy] Error getting folder details for user '${userName}' in college '${collegeName}':`, error.message);
        if (error.response && error.response.data) { // Log Google API specific errors
            console.error('[Drive Service - User Hierarchy] Google API Error Response:', JSON.stringify(error.response.data, null, 2));
        }
        throw new Error(`Failed to get user Drive folder hierarchy: ${error.message}`);
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
    // findOrCreateFolder, // Export if needed directly by other services/routes
};