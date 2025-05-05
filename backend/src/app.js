// backend/server.js (or app.js)
require('dotenv').config(); // Load environment variables FIRST
const express = require('express');
const cors = require('cors');
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
