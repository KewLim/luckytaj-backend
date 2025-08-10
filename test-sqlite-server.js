const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import database adapter and initialize
const dbAdapter = require('./database-adapter');
const ModelsFactory = require('./models-factory');

// Set database type to SQLite
process.env.DB_TYPE = 'sqlite';

const app = express();

// Basic middleware
app.use(express.json());

// Initialize database connection
async function initializeDatabase() {
    try {
        await dbAdapter.connect();
        console.log('✅ Database initialized successfully');
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
        console.log('⚠️  Server will continue without database connection');
    }
}

// Test login route
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('Login attempt for:', email);
        
        // Find admin by email using the model factory
        const Admin = ModelsFactory.Admin;
        const admin = await Admin.findOne({ email, isActive: true });
        
        if (!admin) {
            console.log('Admin not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('Admin found:', admin.email);

        // Check password
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            console.log('Password mismatch');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('Password verified');

        // Update last login
        admin.lastLogin = new Date().toISOString();
        await admin.save();

        // Generate JWT token
        const token = jwt.sign(
            { adminId: admin.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                lastLogin: admin.lastLogin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// Test database info endpoint
app.get('/api/db-info', async (req, res) => {
    try {
        const Admin = ModelsFactory.Admin;
        const admins = await Admin.find();
        
        res.json({
            database: 'SQLite',
            adminCount: admins.length,
            admins: admins.map(a => ({ id: a.id, email: a.email }))
        });
    } catch (error) {
        console.error('DB info error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        database: 'SQLite',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'SQLite Test Server',
        status: 'running',
        endpoints: {
            health: '/health',
            login: '/api/auth/login',
            dbInfo: '/api/db-info'
        }
    });
});

const PORT = 3004; // Use different port to avoid conflicts

// Initialize database then start server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`SQLite test server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
        console.log(`DB Info: http://localhost:${PORT}/api/db-info`);
        console.log(`Login: POST http://localhost:${PORT}/api/auth/login`);
    });
});