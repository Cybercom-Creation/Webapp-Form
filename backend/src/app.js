// backend/server.js (or app.js)
require('dotenv').config(); // Load environment variables FIRST
const express = require('express');
const cors = require('cors');
const http = require('http'); // Import Node's built-in http module
const { WebSocketServer } = require('ws'); // Import WebSocketServer
const connectDB = require('./utils/db'); // Adjust path if needed

// Connect to Database
connectDB();

const app = express();

const allowedOrigins = [process.env.FRONTEND_URL]; // Add other origins if needed (e.g., deployed frontend URL)

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], // <<<=== Ensure PATCH is included here!
  allowedHeaders: ['Content-Type', 'Authorization'], // Add other headers your frontend might send
  credentials: true // If you need to handle cookies or authorization headers
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for images/screenshots
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// --- Define Routes ---
// Example: Assuming you have route files
app.use('/api/users', require('./routes/userRoutes')); // Example path
app.use('/api/proctoring-logs', require('./routes/logRoutes')); // Example path
app.use('/api/screenshots', require('./routes/screenshotRoutes')); // Example path
app.use('/api/form', require('./routes/formRoutes'));

// --- Basic Error Handling (Example) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// --- Create HTTP Server and Integrate WebSocket Server ---
const server = http.createServer(app); // Create an HTTP server from the Express app

const wss = new WebSocketServer({ server }); // Attach WebSocket server to the HTTP server

// Store connected clients, mapping User ID (_id) to WebSocket connection
const clients = new Map(); // Map<userId, WebSocket>

wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');
    // let userId = null; // Keep track of the user ID for this connection
    let emailId = null; // Keep track of the user ID for this connection

    // Handle messages from clients (e.g., identifying the user)
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Expecting an initial message like: { type: 'IDENTIFY', userId: 'someMongoDbId' }
            if (data.type === 'IDENTIFY' && data.email) {
              emailId = data.email;
                // Basic validation: Check if it looks like a MongoDB ObjectId (optional but good)
                if (emailId.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                    clients.set(emailId, ws); // Store the connection mapped to the user ID
                    console.log(`WebSocket client identified as user ID: ${emailId}`);
                    // Optional: Send confirmation back to client
                    ws.send(JSON.stringify({ type: 'IDENTIFIED', message: 'WebSocket connection identified.' }));
                } else {
                    console.warn(`Received invalid user ID format for IDENTIFY: ${emailId}`);
                    ws.close(1008, "Invalid user ID format"); // Close connection with policy violation code
                }
            } else {
                 console.log('Received WebSocket message:', data);
                 // Handle other message types if needed
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message or invalid message format:', message.toString(), error);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected (User ID: ${emailId})`);
        if (emailId) {
            clients.delete(emailId); // Remove client from map on disconnect
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error (User ID: ${emailId}):`, error);
        if (emailId) {
            clients.delete(emailId); // Clean up on error too
        }
    });
});

// Make the clients map accessible to your routes via app.locals
app.locals.wsClients = clients;

const PORT = process.env.PORT || 5000;

// Start the server using the http server instance
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server is also running.`);
});

// Optional: Export app if needed for testing frameworks
// module.exports = app;
