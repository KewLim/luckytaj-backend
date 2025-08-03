const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Store OTP logs in memory and optionally in a file for persistence
let otpLogs = [];
const OTP_LOG_FILE = path.join(__dirname, '..', 'otp-logs.json');

// Load existing logs on startup
async function loadExistingLogs() {
    try {
        const data = await fs.readFile(OTP_LOG_FILE, 'utf8');
        otpLogs = JSON.parse(data);
        console.log(`Loaded ${otpLogs.length} existing OTP logs`);
    } catch (error) {
        console.log('No existing OTP logs found, starting fresh');
        otpLogs = [];
    }
}

// Save logs to file
async function saveLogs() {
    try {
        await fs.writeFile(OTP_LOG_FILE, JSON.stringify(otpLogs, null, 2));
    } catch (error) {
        console.error('Error saving OTP logs:', error);
    }
}

// Initialize logs on server start
loadExistingLogs();

// POST /api/otp-log - Log OTP verification attempt
router.post('/log', async (req, res) => {
    try {
        const { phone, otpCode, timestamp } = req.body;
        
        if (!phone || !otpCode) {
            return res.status(400).json({ 
                error: 'Phone number and OTP code are required' 
            });
        }
        
        const logEntry = {
            id: Date.now().toString(),
            phone,
            otpCode,
            timestamp: timestamp || new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown',
            action: 'verification'
        };
        
        // Add to memory
        otpLogs.unshift(logEntry); // Add to beginning for latest first
        
        // Keep only last 1000 entries to prevent memory issues
        if (otpLogs.length > 1000) {
            otpLogs = otpLogs.slice(0, 1000);
        }
        
        console.log(`OTP logged: ${phone} - ${otpCode} at ${logEntry.timestamp}`);
        
        // Update corresponding request status to 'verified' if it exists
        const matchingRequest = otpLogs.find(log => 
            log.phone === phone && 
            log.otpCode === otpCode && 
            log.action === 'request' && 
            log.status === 'pending'
        );
        
        if (matchingRequest) {
            matchingRequest.status = 'verified';
            matchingRequest.verifiedAt = logEntry.timestamp;
            console.log(`Updated request ${matchingRequest.id} status to verified`);
            
            // Call metrics endpoint to link phone with tip ID if tipId is available
            if (req.body.tipId) {
                try {
                    const axios = require('axios');
                    await axios.post(`http://localhost:${process.env.PORT || 3003}/api/metrics/link-phone`, {
                        tipId: req.body.tipId,
                        phoneNumber: phone
                    });
                    console.log(`Linked verified phone ${phone} to tip ${req.body.tipId}`);
                } catch (error) {
                    console.error('Error linking phone to tip:', error.message);
                }
            }
        }
        
        // Save to file (async, don't wait)
        saveLogs().catch(err => console.error('Error saving logs:', err));
        
        res.json({ 
            success: true, 
            message: 'OTP verification logged successfully',
            logId: logEntry.id 
        });
        
    } catch (error) {
        console.error('Error logging OTP:', error);
        res.status(500).json({ 
            error: 'Internal server error while logging OTP' 
        });
    }
});

// POST /api/otp/request - Log OTP request (when user requests OTP)
router.post('/request', async (req, res) => {
    try {
        const { phone, timestamp } = req.body;
        
        if (!phone) {
            return res.status(400).json({ 
                error: 'Phone number is required' 
            });
        }
        
        // Generate OTP for display purposes
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const requestEntry = {
            id: Date.now().toString(),
            phone,
            otpCode,
            timestamp: timestamp || new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown',
            action: 'request',
            status: 'pending'
        };
        
        // Add to memory
        otpLogs.unshift(requestEntry); // Add to beginning for latest first
        
        // Keep only last 1000 entries to prevent memory issues
        if (otpLogs.length > 1000) {
            otpLogs = otpLogs.slice(0, 1000);
        }
        
        // Save to file (async, don't wait)
        saveLogs().catch(err => console.error('Error saving logs:', err));
        
        console.log(`OTP request logged: ${phone} - ${otpCode} at ${requestEntry.timestamp}`);
        
        res.json({ 
            success: true, 
            message: 'OTP request logged successfully',
            otpCode: otpCode,
            logId: requestEntry.id 
        });
        
    } catch (error) {
        console.error('Error logging OTP request:', error);
        res.status(500).json({ 
            error: 'Internal server error while logging OTP request' 
        });
    }
});

// GET /api/otp-log - Get all OTP logs (for admin panel)
router.get('/logs', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const paginatedLogs = otpLogs.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            logs: paginatedLogs,
            pagination: {
                current: page,
                total: Math.ceil(otpLogs.length / limit),
                count: paginatedLogs.length,
                totalLogs: otpLogs.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching OTP logs:', error);
        res.status(500).json({ 
            error: 'Internal server error while fetching logs' 
        });
    }
});

// GET /api/otp-log/stats - Get OTP statistics
router.get('/stats', (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayLogs = otpLogs.filter(log => 
            new Date(log.timestamp) >= today
        );
        
        const uniquePhones = new Set(otpLogs.map(log => log.phone)).size;
        const todayUniquePhones = new Set(todayLogs.map(log => log.phone)).size;
        
        res.json({
            success: true,
            stats: {
                totalRequests: otpLogs.length,
                todayRequests: todayLogs.length,
                uniquePhoneNumbers: uniquePhones,
                todayUniquePhones: todayUniquePhones,
                lastRequestTime: otpLogs.length > 0 ? otpLogs[0].timestamp : null
            }
        });
        
    } catch (error) {
        console.error('Error fetching OTP stats:', error);
        res.status(500).json({ 
            error: 'Internal server error while fetching stats' 
        });
    }
});

// DELETE /api/otp-log/clear - Clear all logs (admin only)
router.delete('/clear', (req, res) => {
    try {
        const backupLogs = [...otpLogs];
        otpLogs = [];
        
        // Save empty logs
        saveLogs().catch(err => console.error('Error clearing logs file:', err));
        
        console.log(`Cleared ${backupLogs.length} OTP logs`);
        
        res.json({
            success: true,
            message: `Cleared ${backupLogs.length} OTP logs`
        });
        
    } catch (error) {
        console.error('Error clearing OTP logs:', error);
        res.status(500).json({ 
            error: 'Internal server error while clearing logs' 
        });
    }
});

module.exports = router;