const express = require('express');
const router = express.Router();
const GameConfig = require('../models/GameConfig');
const Game = require('../models/Game');
const DailyGames = require('../models/DailyGames');
const authMiddleware = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');
const { manualRefresh } = require('../services/dailyRefresh');

// Helper function to get today's date in IST timezone as string (YYYY-MM-DD)
function getTodayIST() {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istTime.toISOString().split('T')[0];
}

// Helper function to select and cache daily games
async function selectDailyGames() {
    try {
        const today = getTodayIST();
        
        // Check if we already have games selected for today
        let todayGames = await DailyGames.findOne({ date: today });
        
        if (todayGames) {
            console.log('Daily games already selected for', today);
            return todayGames;
        }
        
        // Select new games for today
        const activeGames = await Game.find({ active: true });
        
        if (activeGames.length === 0) {
            console.log('No active games available for daily selection');
            return null;
        }
        
        // Randomly select 3 games
        const shuffledGames = activeGames.sort(() => 0.5 - Math.random());
        const selectedGames = shuffledGames.slice(0, Math.min(3, activeGames.length));
        
        // Format selected games
        const formattedGames = selectedGames.map(game => ({
            gameId: game._id,
            title: game.title,
            image: game.image,
            recentWin: game.recentWin
        }));
        
        // Save to database
        todayGames = new DailyGames({
            date: today,
            selectedGames: formattedGames,
            refreshedAt: new Date()
        });
        
        await todayGames.save();
        console.log('New daily games selected for', today, ':', formattedGames);
        
        return todayGames;
    } catch (error) {
        console.error('Error selecting daily games:', error);
        return null;
    }
}

// Get available images from images folder
router.get('/images', authMiddleware, async (req, res) => {
    try {
        const imagesPath = path.join(__dirname, '../images');
        const files = await fs.readdir(imagesPath);
        const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
        );
        
        res.json(imageFiles.map(file => ({
            filename: file,
            path: `/images/${file}`,
            name: file.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        })));
    } catch (error) {
        console.error('Error fetching game images:', error);
        res.status(500).json({ error: 'Failed to fetch game images' });
    }
});

// Public endpoint for active games (for frontend real-time display)
router.get('/public', async (req, res) => {
    try {
        const games = await Game.find({ active: true }).limit(20);
        res.json(games);
    } catch (error) {
        console.error('Error fetching public games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// Get all games from database
router.get('/list', authMiddleware, async (req, res) => {
    try {
        const games = await Game.find().sort({ order: 1, createdAt: -1 });
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// Add new game with selected image
router.post('/add', authMiddleware, async (req, res) => {
    try {
        const { title, selectedImage, winAmount, winPlayer, winComment } = req.body;

        if (!title || !selectedImage) {
            return res.status(400).json({ error: 'Game title and image are required' });
        }

        const game = new Game({
            title,
            image: selectedImage, // Store the filename from images folder
            recentWin: {
                amount: winAmount || '$5,000',
                player: winPlayer || 'Lucky***Player',
                comment: winComment || 'Amazing game! Just won big!'
            },
            createdBy: req.admin.id
        });

        await game.save();

        res.status(201).json({ 
            message: 'Game added successfully',
            game 
        });
    } catch (error) {
        console.error('Error adding game:', error);
        res.status(500).json({ error: 'Failed to add game' });
    }
});

// Update game
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, recentWin, active } = req.body;
        
        const game = await Game.findById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        game.title = title || game.title;
        game.recentWin = recentWin || game.recentWin;
        if (typeof active !== 'undefined') game.active = active;

        await game.save();

        res.json({ 
            message: 'Game updated successfully',
            game 
        });
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ error: 'Failed to update game' });
    }
});

// Delete game
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        await Game.findByIdAndDelete(req.params.id);

        res.json({ message: 'Game deleted successfully' });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'Failed to delete game' });
    }
});

// Manual refresh daily games (admin endpoint) - triggers same logic as automatic refresh
router.post('/refresh', authMiddleware, async (req, res) => {
    try {
        const activeGames = await Game.find({ active: true });
        
        if (activeGames.length === 0) {
            return res.status(400).json({ 
                error: 'No active games found. Please add games through admin panel first.',
                success: false
            });
        }

        // Use the same refresh logic as automatic scheduler
        const refreshSuccess = await manualRefresh();
        
        if (!refreshSuccess) {
            return res.status(500).json({
                error: 'Failed to refresh daily games',
                success: false
            });
        }

        // Get the newly selected games
        const today = getTodayIST();
        const todayGames = await DailyGames.findOne({ date: today });
        
        const gameConfig = await GameConfig.findOne();

        res.json({
            message: 'Daily games refreshed successfully (manual trigger)',
            success: true,
            totalActiveGames: activeGames.length,
            newGames: todayGames?.selectedGames.map(game => game.title) || [],
            date: today,
            lastRefresh: gameConfig?.lastRefresh || new Date(),
            nextRefresh: gameConfig?.refreshTime || '02:00'
        });
    } catch (error) {
        console.error('Error in manual refresh:', error);
        res.status(500).json({ 
            error: 'Failed to refresh games pool',
            success: false
        });
    }
});

// Get today's cached daily games for all players (public endpoint)
router.get('/daily', async (req, res) => {
    try {
        // Get or select today's games
        const todayGames = await selectDailyGames();
        
        if (!todayGames || !todayGames.selectedGames || todayGames.selectedGames.length === 0) {
            console.log('No daily games available. Database may be empty.');
            return res.json([]);
        }
        
        // Format for frontend compatibility
        const formattedGames = todayGames.selectedGames.map((game, index) => ({
            id: index + 1,
            title: game.title,
            image: `/images/${game.image}`,
            screenshot: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMkYxQjY5Ii8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmaWxsPSIjRkZENzAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjI0Ij7wn5qoIEpBQ0tQT1QhIPCfmpg8L3RleHQ+Cjx0ZXh0IHg9IjE1MCIgeT0iMTMwIiBmaWxsPSIjRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE2Ij4ke2dhbWUucmVjZW50V2luLmFtb3VudH08L3RleHQ+Cjwvc3ZnPg==`,
            recentWin: game.recentWin
        }));
        
        console.log(`Daily games API - Serving ${formattedGames.length} cached games for ${todayGames.date}`);
        res.json(formattedGames);
    } catch (error) {
        console.error('Error fetching daily games:', error);
        res.status(500).json({ error: 'Failed to fetch daily games' });
    }
});

module.exports = router;