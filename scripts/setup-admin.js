const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Admin = require('../models/Admin');

async function setupAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
        
        if (existingAdmin) {
            console.log('Admin user already exists:', process.env.ADMIN_EMAIL);
            process.exit(0);
        }

        // Create admin user
        const admin = new Admin({
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD
        });

        await admin.save();
        console.log('Admin user created successfully:', process.env.ADMIN_EMAIL);
        console.log('Password:', process.env.ADMIN_PASSWORD);
        console.log('\nIMPORTANT: Change the default password after first login!');
        
    } catch (error) {
        console.error('Error setting up admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

setupAdmin();