const cron = require('node-cron');
const Game = require('../models/Game');
const DailyGames = require('../models/DailyGames');
const GameConfig = require('../models/GameConfig');

// Helper function to get today's date in IST timezone as string (YYYY-MM-DD)
function getTodayIST() {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istTime.toISOString().split('T')[0];
}

// Function to refresh daily games
async function refreshDailyGames() {
    try {
        console.log('=== AUTOMATIC DAILY GAMES REFRESH STARTED ===');
        const today = getTodayIST();
        
        // Get active games
        const activeGames = await Game.find({ active: true });
        
        if (activeGames.length === 0) {
            console.log('No active games available for automatic refresh');
            return false;
        }
        
        // Delete existing games for today
        await DailyGames.deleteOne({ date: today });
        console.log(`Cleared existing games for ${today}`);
        
        // Select new random games
        const shuffledGames = activeGames.sort(() => 0.5 - Math.random());
        const selectedGames = shuffledGames.slice(0, Math.min(3, activeGames.length));
        
        // Format selected games
        const formattedGames = selectedGames.map(game => ({
            gameId: game._id,
            title: game.title,
            image: game.image,
            recentWin: game.recentWin
        }));
        
        // Save new daily games
        const newDailyGames = new DailyGames({
            date: today,
            selectedGames: formattedGames,
            refreshedAt: new Date()
        });
        
        await newDailyGames.save();
        
        // Update GameConfig
        let gameConfig = await GameConfig.findOne();
        if (gameConfig) {
            gameConfig.lastRefresh = new Date();
            await gameConfig.save();
        }
        
        console.log(`✅ Daily games refreshed automatically for ${today}`);
        console.log('New games:', formattedGames.map(g => g.title));
        console.log('=== AUTOMATIC DAILY GAMES REFRESH COMPLETED ===');
        
        return true;
    } catch (error) {
        console.error('❌ Error during automatic daily games refresh:', error);
        return false;
    }
}

// Function to start the daily refresh scheduler
function startDailyRefreshScheduler() {
    // Get refresh time from GameConfig or use default 2:00 AM IST
    GameConfig.findOne()
        .then(config => {
            const refreshTime = config?.refreshTime || '02:00';
            const [hour, minute] = refreshTime.split(':');
            
            // Schedule cron job for daily refresh at specified IST time
            // Format: minute hour * * * (runs every day at specified time)
            const cronPattern = `${minute} ${hour} * * *`;
            
            console.log(`🕐 Daily games refresh scheduled for ${refreshTime} IST daily`);
            console.log(`📅 Cron pattern: ${cronPattern}`);
            
            // Schedule the job with IST timezone
            cron.schedule(cronPattern, async () => {
                console.log(`⏰ Triggered daily games refresh at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                await refreshDailyGames();
            }, {
                scheduled: true,
                timezone: 'Asia/Kolkata'
            });
            
            console.log('✅ Daily games refresh scheduler started successfully');
        })
        .catch(error => {
            console.error('Error setting up daily refresh scheduler:', error);
            // Fallback to default 2:00 AM IST if config fails
            cron.schedule('0 2 * * *', async () => {
                console.log(`⏰ Triggered daily games refresh (fallback) at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                await refreshDailyGames();
            }, {
                scheduled: true,
                timezone: 'Asia/Kolkata'
            });
            console.log('✅ Daily games refresh scheduler started with fallback time (2:00 AM IST)');
        });
}

// Function to manually trigger refresh (for admin use)
async function manualRefresh() {
    console.log('Manual refresh triggered by admin');
    return await refreshDailyGames();
}

module.exports = {
    startDailyRefreshScheduler,
    manualRefresh,
    refreshDailyGames
};