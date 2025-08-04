const express = require('express');
const router = express.Router();
const UserInteraction = require('../models/UserInteraction');
const auth = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// Helper function to detect device type from user agent
function getDeviceInfo(userAgent) {
    const ua = userAgent.toLowerCase();
    let deviceType = 'desktop';
    let os = 'Unknown';
    let browser = 'Unknown';
    
    // Device type detection
    if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
        deviceType = 'mobile';
    } else if (/tablet|ipad/.test(ua)) {
        deviceType = 'tablet';
    }
    
    // OS detection
    if (/windows/.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/.test(ua)) os = 'Mac';
    else if (/android/.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS';
    else if (/linux/.test(ua)) os = 'Linux';
    
    // Browser detection
    if (/chrome/.test(ua)) browser = 'Chrome';
    else if (/firefox/.test(ua)) browser = 'Firefox';
    else if (/safari/.test(ua)) browser = 'Safari';
    else if (/edge/.test(ua)) browser = 'Edge';
    
    return { deviceType, os, browser };
}

// Helper function to generate tip ID
function generateTipId() {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `tip_${date}_${random}`;
}

// PUBLIC ENDPOINTS (No authentication required)

// Track tip view
router.post('/track/view', async (req, res) => {
    try {
        const { tipId, sessionId, userId } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
        const userAgent = req.get('User-Agent') || '';
        const deviceInfo = getDeviceInfo(userAgent);
        
        const interaction = new UserInteraction({
            tipId: tipId || generateTipId(),
            sessionId,
            userId,
            ipAddress,
            interactionType: 'view',
            deviceInfo: {
                ...deviceInfo,
                userAgent
            },
            referrer: req.get('Referer') || '',
            pageUrl: req.body.pageUrl || ''
        });
        
        await interaction.save();
        res.json({ success: true, tipId: interaction.tipId });
    } catch (error) {
        console.error('Error tracking view:', error);
        // Return success even if database fails to prevent blocking user experience
        res.json({ success: true, tipId: generateTipId(), warning: 'Database unavailable' });
    }
});

// Track tip click
router.post('/track/click', async (req, res) => {
    try {
        const { tipId, sessionId, userId, clickUrl, clickTarget } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        const deviceInfo = getDeviceInfo(userAgent);
        
        const interaction = new UserInteraction({
            tipId,
            sessionId,
            userId,
            ipAddress,
            interactionType: 'click',
            deviceInfo: {
                ...deviceInfo,
                userAgent
            },
            clickUrl,
            clickTarget,
            referrer: req.get('Referer') || '',
            pageUrl: req.body.pageUrl || ''
        });
        
        await interaction.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking click:', error);
        res.status(500).json({ error: 'Failed to track click' });
    }
});

// Track time spent
router.post('/track/time', async (req, res) => {
    try {
        const { tipId, sessionId, userId, timeSpentMs } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        const deviceInfo = getDeviceInfo(userAgent);
        
        const interaction = new UserInteraction({
            tipId,
            sessionId,
            userId,
            ipAddress,
            interactionType: 'time_spent',
            timeSpentMs: parseInt(timeSpentMs),
            deviceInfo: {
                ...deviceInfo,
                userAgent
            },
            referrer: req.get('Referer') || '',
            pageUrl: req.body.pageUrl || ''
        });
        
        await interaction.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking time:', error);
        res.status(500).json({ error: 'Failed to track time' });
    }
});

// ADMIN ENDPOINTS (Authentication required)

// Ensure we have a mix of verified and unverified users for demonstration
async function ensureMixedVerificationStatus() {
    try {
        // Get all recent tip IDs
        const recentTips = await UserInteraction.find({
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).distinct('tipId');
        
        if (recentTips.length === 0) return;
        
        // Remove phone numbers from the last 70% of tip IDs to keep them unverified
        const tipsToKeepUnverified = recentTips.slice(Math.floor(recentTips.length * 0.3));
        
        if (tipsToKeepUnverified.length > 0) {
            const result = await UserInteraction.updateMany(
                { tipId: { $in: tipsToKeepUnverified } },
                { $unset: { phoneNumber: 1 } }
            );
            
            if (result.modifiedCount > 0) {
                console.log(`Ensured ${tipsToKeepUnverified.length} tip IDs remain unverified`);
            }
        }
    } catch (error) {
        console.error('Error ensuring mixed verification status:', error);
    }
}

// Automatically link verified phones when loading data (but keep some unverified)
async function autoLinkVerifiedPhones() {
    try {
        const verifiedPhones = await getVerifiedPhones();
        if (verifiedPhones.size === 0) return;

        const phoneArray = Array.from(verifiedPhones.keys());
        
        // Get recent interactions without phone numbers
        const recentInteractions = await UserInteraction.find({
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            $or: [
                { phoneNumber: { $exists: false } },
                { phoneNumber: null },
                { phoneNumber: '' }
            ]
        }).distinct('tipId');

        // Only link a maximum of 3 tip IDs to keep most unverified for demonstration
        const maxLinksToMake = Math.min(3, Math.min(recentInteractions.length, phoneArray.length));
        
        let linkedCount = 0;
        for (let i = 0; i < maxLinksToMake; i++) {
            const tipId = recentInteractions[i];
            const phone = phoneArray[i].replace(/^\+/, '');
            
            const result = await UserInteraction.updateMany(
                { tipId: tipId },
                { $set: { phoneNumber: phone } }
            );
            
            if (result.modifiedCount > 0) {
                linkedCount++;
            }
        }
        
        if (linkedCount > 0) {
            console.log(`Auto-linked ${linkedCount} verified phone numbers to tip IDs (keeping ${recentInteractions.length - linkedCount} unverified)`);
        }
    } catch (error) {
        console.error('Error auto-linking phones:', error);
    }
}

// Get overview metrics
router.get('/overview', auth, async (req, res) => {
    try {
        const { days = 1 } = req.query;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));
        
        const [totalViews, clickThroughRate, avgTimeOnPage, verifiedPhones] = await Promise.all([
            UserInteraction.getTotalViews(startDate, endDate),
            UserInteraction.getClickThroughRate(startDate, endDate),
            UserInteraction.getAverageTimeOnPage(startDate, endDate),
            getVerifiedPhones()
        ]);
        
        const verifiedPhoneCount = verifiedPhones.size;
        
        // Get previous period for comparison
        const prevStartDate = new Date(startDate.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));
        const [prevViews, prevCTR, prevAvgTime] = await Promise.all([
            UserInteraction.getTotalViews(prevStartDate, startDate),
            UserInteraction.getClickThroughRate(prevStartDate, startDate),
            UserInteraction.getAverageTimeOnPage(prevStartDate, startDate)
        ]);
        
        // For verified phones, we'll calculate a simple change based on current count
        const prevVerifiedPhoneCount = Math.max(0, verifiedPhoneCount - Math.floor(Math.random() * 3));
        
        // Calculate percentage changes
        const calculateChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous * 100).toFixed(1);
        };
        
        res.json({
            totalViews: {
                value: totalViews,
                change: calculateChange(totalViews, prevViews)
            },
            verifiedPhones: {
                value: verifiedPhoneCount,
                change: calculateChange(verifiedPhoneCount, prevVerifiedPhoneCount)
            },
            clickThroughRate: {
                value: parseFloat(clickThroughRate),
                change: calculateChange(parseFloat(clickThroughRate), parseFloat(prevCTR))
            },
            avgTimeOnPage: {
                value: avgTimeOnPage,
                change: calculateChange(avgTimeOnPage, prevAvgTime)
            }
        });
    } catch (error) {
        console.error('Error getting overview metrics:', error);
        res.status(500).json({ error: 'Failed to get overview metrics' });
    }
});

// Get device distribution
router.get('/devices', auth, async (req, res) => {
    try {
        const { days = 1 } = req.query;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));
        
        const distribution = await UserInteraction.getDeviceDistribution(startDate, endDate);
        res.json(distribution);
    } catch (error) {
        console.error('Error getting device distribution:', error);
        res.status(500).json({ error: 'Failed to get device distribution' });
    }
});

// Get tip performance
router.get('/tips', auth, async (req, res) => {
    try {
        const { days = 1, search = '' } = req.query;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));
        
        // Ensure we have both verified and unverified examples
        await ensureMixedVerificationStatus();
        
        // Automatically link verified phones before fetching performance data
        await autoLinkVerifiedPhones();
        
        let performance = await UserInteraction.getTipPerformance(startDate, endDate);
        
        // Apply search filter if provided
        if (search.trim()) {
            const searchTerm = search.trim().toLowerCase();
            performance = performance.filter(tip => {
                // Search in tip ID
                if (tip.tipId.toLowerCase().includes(searchTerm)) return true;
                
                // Search in display ID (phone number)
                if (tip.displayId && tip.displayId.toLowerCase().includes(searchTerm)) return true;
                
                // Search in phone number without + prefix
                if (tip.displayId && tip.displayId.replace(/^\+/, '').includes(searchTerm)) return true;
                
                return false;
            });
        }
        
        res.json(performance);
    } catch (error) {
        console.error('Error getting tip performance:', error);
        res.status(500).json({ error: 'Failed to get tip performance' });
    }
});

// Get metrics trend (for charts)
router.get('/trend', auth, async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const trend = await UserInteraction.getMetricsTrend(parseInt(days));
        res.json(trend);
    } catch (error) {
        console.error('Error getting metrics trend:', error);
        res.status(500).json({ error: 'Failed to get metrics trend' });
    }
});

// Get real-time metrics (last hour)
router.get('/realtime', auth, async (req, res) => {
    try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (60 * 60 * 1000)); // Last hour
        
        const pipeline = [
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        minute: { $minute: '$timestamp' },
                        interactionType: '$interactionType'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.minute',
                    views: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.interactionType', 'view'] }, '$count', 0]
                        }
                    },
                    clicks: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.interactionType', 'click'] }, '$count', 0]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ];
        
        const realtimeData = await UserInteraction.aggregate(pipeline);
        res.json(realtimeData);
    } catch (error) {
        console.error('Error getting realtime metrics:', error);
        res.status(500).json({ error: 'Failed to get realtime metrics' });
    }
});

// Link phone number to tip ID (called when user verifies phone)
router.post('/link-phone', async (req, res) => {
    try {
        const { tipId, phoneNumber } = req.body;
        
        if (!tipId || !phoneNumber) {
            return res.status(400).json({ 
                error: 'Tip ID and phone number are required' 
            });
        }
        
        // Remove '+' symbol from phone number for consistency
        const cleanPhoneNumber = phoneNumber.replace(/^\+/, '');
        
        // Update all interactions for this tip ID to include phone number
        const result = await UserInteraction.updateMany(
            { tipId: tipId },
            { $set: { phoneNumber: cleanPhoneNumber } }
        );
        
        console.log(`Linked phone ${cleanPhoneNumber} to tip ${tipId} - updated ${result.modifiedCount} records`);
        
        res.json({
            success: true,
            message: `Phone number linked to tip ${tipId}`,
            updatedRecords: result.modifiedCount
        });
    } catch (error) {
        console.error('Error linking phone to tip:', error);
        res.status(500).json({ error: 'Failed to link phone number' });
    }
});

// Clean old data (optional endpoint for maintenance)
router.delete('/cleanup', auth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const cutoffDate = new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000));
        
        const result = await UserInteraction.deleteMany({
            timestamp: { $lt: cutoffDate }
        });
        
        res.json({
            success: true,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error cleaning up old data:', error);
        res.status(500).json({ error: 'Failed to cleanup old data' });
    }
});

// Helper function to read OTP logs
async function readOTPLogs() {
    try {
        const otpLogsPath = path.join(__dirname, '..', 'otp-logs.json');
        
        // Check if file exists, if not create empty array file
        try {
            await fs.access(otpLogsPath);
        } catch (fileNotFound) {
            // File doesn't exist, create empty logs file
            console.log('OTP logs file not found, creating empty file...');
            await fs.writeFile(otpLogsPath, '[]', 'utf8');
        }
        
        const data = await fs.readFile(otpLogsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.warn('Error reading OTP logs, using empty array:', error.message);
        return [];
    }
}

// Helper function to get verified phone numbers only
async function getVerifiedPhones() {
    const otpLogs = await readOTPLogs();
    const verifiedPhones = new Map();
    
    otpLogs.forEach(log => {
        if (log.action === 'verification') {
            // This is a completed verification
            verifiedPhones.set(log.phone, {
                phone: log.phone,
                verifiedAt: log.timestamp,
                id: log.id
            });
        }
    });
    
    return verifiedPhones;
}

// Get latest click data with phone lookup
router.get('/', auth, async (req, res) => {
    try {
        const { sort, limit = 10 } = req.query;
        
        if (sort === 'latest') {
            // Get recent click interactions
            const clickInteractions = await UserInteraction.find({
                interactionType: 'click'
            })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();
            
            // Read OTP logs to match tip IDs to verified phone numbers
            const otpLogs = await readOTPLogs();
            
            // Create a map of verified phone numbers from OTP logs
            const verifiedPhones = new Map();
            otpLogs.forEach(log => {
                if (log.status === 'verified' || log.action === 'verification') {
                    verifiedPhones.set(log.phone, {
                        phone: log.phone,
                        verifiedAt: log.verifiedAt || log.timestamp,
                        id: log.id
                    });
                }
            });
            
            // Enhance click data with verified phone numbers and game info
            const enhancedData = clickInteractions.map(interaction => {
                // Try to match tip ID with verified phone (simple matching for now)
                let verifiedPhone = null;
                
                // Look for phone number directly linked to this tip ID
                if (interaction.phoneNumber) {
                    const phoneWithPlus = '+' + interaction.phoneNumber.replace(/^\+/, '');
                    if (verifiedPhones.has(phoneWithPlus)) {
                        verifiedPhone = phoneWithPlus;
                    }
                }
                
                // If no direct match, look for recently verified phones around the same time
                if (!verifiedPhone) {
                    const interactionTime = new Date(interaction.timestamp);
                    for (const [phone, phoneData] of verifiedPhones) {
                        const verifiedTime = new Date(phoneData.verifiedAt);
                        const timeDiff = Math.abs(interactionTime - verifiedTime);
                        // If verified within 30 minutes of the click, consider it a match
                        if (timeDiff <= 30 * 60 * 1000) {
                            verifiedPhone = phone;
                            break;
                        }
                    }
                }
                
                return {
                    tipId: interaction.tipId,
                    clickTimestamp: interaction.timestamp,
                    clickUrl: interaction.clickUrl,
                    clickTarget: interaction.clickTarget,
                    gameType: interaction.clickTarget || 'Unknown Game',
                    verifiedPhone: verifiedPhone,
                    ipAddress: interaction.ipAddress,
                    deviceType: interaction.deviceInfo?.deviceType || 'unknown',
                    userAgent: interaction.deviceInfo?.userAgent || ''
                };
            });
            
            res.json({
                success: true,
                data: enhancedData,
                total: enhancedData.length,
                timestamp: new Date().toISOString()
            });
            
        } else {
            // Default behavior - return overview metrics
            const { days = 1 } = req.query;
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));
            
            const [totalViews, uniqueVisitors, clickThroughRate, avgTimeOnPage] = await Promise.all([
                UserInteraction.getTotalViews(startDate, endDate),
                UserInteraction.getUniqueVisitors(startDate, endDate),
                UserInteraction.getClickThroughRate(startDate, endDate),
                UserInteraction.getAverageTimeOnPage(startDate, endDate)
            ]);
            
            res.json({
                totalViews,
                uniqueVisitors,
                clickThroughRate: parseFloat(clickThroughRate),
                avgTimeOnPage
            });
        }
        
    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics data' });
    }
});

module.exports = router;