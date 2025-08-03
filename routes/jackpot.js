const express = require('express');
const router = express.Router();
const JackpotMessage = require('../models/JackpotMessage');
const authMiddleware = require('../middleware/auth');

// Get all jackpot messages
router.get('/', authMiddleware, async (req, res) => {
    try {
        const messages = await JackpotMessage.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching jackpot messages:', error);
        res.status(500).json({ error: 'Failed to fetch jackpot messages' });
    }
});

// Get active jackpot messages (public endpoint for frontend)
router.get('/active', async (req, res) => {
    try {
        const messages = await JackpotMessage.find({ active: true })
            .sort({ createdAt: -1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching active jackpot messages:', error);
        res.status(500).json({ error: 'Failed to fetch active jackpot messages' });
    }
});

// Add new jackpot message
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { message, category, predictionTime } = req.body;

        if (!message || !category || !predictionTime) {
            return res.status(400).json({ error: 'Message, category, and prediction time are required' });
        }

        const jackpotMessage = new JackpotMessage({
            message,
            category,
            predictionTime,
            createdBy: req.admin.id
        });

        await jackpotMessage.save();

        res.status(201).json({ 
            message: 'Jackpot message added successfully',
            jackpotMessage 
        });
    } catch (error) {
        console.error('Error adding jackpot message:', error);
        res.status(500).json({ error: 'Failed to add jackpot message' });
    }
});

// Update jackpot message
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { message, category, predictionTime, active } = req.body;
        
        const jackpotMessage = await JackpotMessage.findById(req.params.id);
        if (!jackpotMessage) {
            return res.status(404).json({ error: 'Jackpot message not found' });
        }

        jackpotMessage.message = message || jackpotMessage.message;
        jackpotMessage.category = category || jackpotMessage.category;
        jackpotMessage.predictionTime = predictionTime || jackpotMessage.predictionTime;
        if (typeof active !== 'undefined') {
            jackpotMessage.active = active;
        }

        await jackpotMessage.save();

        res.json({ 
            message: 'Jackpot message updated successfully',
            jackpotMessage 
        });
    } catch (error) {
        console.error('Error updating jackpot message:', error);
        res.status(500).json({ error: 'Failed to update jackpot message' });
    }
});

// Delete jackpot message
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const jackpotMessage = await JackpotMessage.findById(req.params.id);
        if (!jackpotMessage) {
            return res.status(404).json({ error: 'Jackpot message not found' });
        }

        await JackpotMessage.findByIdAndDelete(req.params.id);

        res.json({ message: 'Jackpot message deleted successfully' });
    } catch (error) {
        console.error('Error deleting jackpot message:', error);
        res.status(500).json({ error: 'Failed to delete jackpot message' });
    }
});

module.exports = router;