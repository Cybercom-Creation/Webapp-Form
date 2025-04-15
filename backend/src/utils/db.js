// const mysql = require('mysql');

// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password:'1234',
//     database: 'user_details_db'
// });

// db.connect((err) => {
//     if (err) {
//         console.error('Database connection failed: ' + err.stack);
//         return;
//     }
//     console.log('Connected to database.');
// });

// module.exports = db;


// const mysql = require('mysql'); // Remove this line
const mysql = require('mysql2'); // Add this line

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234', // Consider using environment variables for credentials
    database: 'user_details_db'
});

db.connect((err) => {
    if (err) {
        // It's often better to throw the error or handle it more gracefully
        // in a real application, perhaps attempting a reconnect or exiting.
        console.error('Database connection failed:', err);
        // Avoid just logging the stack trace directly in production if possible
        // console.error('Database connection failed: ' + err.stack);
        process.exit(1); // Exit if connection fails on startup
        // return; // Not needed if exiting
    }
    console.log('Connected to database.');
});

// Optional: Add error handling for the connection itself after initial connect
db.on('error', function(err) {
  console.error('Database error:', err);
  // Handle errors like connection loss, etc.
  // Example: Check for disconnect errors
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Attempting to reconnect...');
    // Implement reconnection logic if needed
  } else {
    throw err; // Or handle other errors appropriately
  }
});


module.exports = db;
