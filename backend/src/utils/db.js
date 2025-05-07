// backend/src/config/db.js
const mongoose = require('mongoose');
require('dotenv').config(); // Load env vars

const connectDB = async () => {
    try {
        // Use the MONGODB_URI from your .env file
        //const conn = await mongoose.connect('mongodb+srv://Keyur:Keyur%40cybercom@webappcluster.p5rm4nb.mongodb.net/?retryWrites=true&w=majority&appName=WebappCluster');
        const conn = await mongoose.connect(process.env.MONGODB_URI); //for live url
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Exit process with failure if connection fails
        process.exit(1);
    }
};

module.exports = connectDB;
