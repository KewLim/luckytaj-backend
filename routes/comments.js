const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all comments
router.get('/', authMiddleware, async (req, res) => {
    try {
        const comments = await Comment.find()
            .populate('addedBy', 'email')
            .sort({ createdAt: -1 });
        
        res.json(comments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Get active comments for frontend
router.get('/active', async (req, res) => {
    try {
        const comments = await Comment.find({ isActive: true })
            .select('username comment avatar timestamp')
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json(comments);
    } catch (error) {
        console.error('Get active comments error:', error);
        res.status(500).json({ error: 'Failed to fetch active comments' });
    }
});

// Add new comment
router.post('/', authMiddleware, [
    body('username').trim().isLength({ min: 1, max: 50 }),
    body('comment').trim().isLength({ min: 1, max: 500 }),
    body('avatar').optional().trim().isLength({ max: 10 }),
    body('timestamp').optional().trim().isLength({ max: 20 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid input', details: errors.array() });
        }

        const comment = new Comment({
            username: req.body.username,
            comment: req.body.comment,
            avatar: req.body.avatar || '🎮',
            timestamp: req.body.timestamp || undefined, // Will use default function if not provided
            addedBy: req.admin._id
        });

        await comment.save();
        await comment.populate('addedBy', 'email');

        res.status(201).json({
            message: 'Comment added successfully',
            comment
        });
    } catch (error) {
        console.error('Comment add error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Update comment
router.patch('/:id', authMiddleware, [
    body('username').optional().trim().isLength({ min: 1, max: 50 }),
    body('comment').optional().trim().isLength({ min: 1, max: 500 }),
    body('avatar').optional().trim().isLength({ max: 10 }),
    body('timestamp').optional().trim().isLength({ max: 20 }),
    body('isActive').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid input', details: errors.array() });
        }

        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Update allowed fields
        if (req.body.username !== undefined) comment.username = req.body.username;
        if (req.body.comment !== undefined) comment.comment = req.body.comment;
        if (req.body.avatar !== undefined) comment.avatar = req.body.avatar;
        if (req.body.timestamp !== undefined) comment.timestamp = req.body.timestamp;
        if (req.body.isActive !== undefined) comment.isActive = req.body.isActive;

        await comment.save();
        await comment.populate('addedBy', 'email');

        res.json({
            message: 'Comment updated successfully',
            comment
        });
    } catch (error) {
        console.error('Comment update error:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Delete comment
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        await Comment.findByIdAndDelete(req.params.id);

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Comment delete error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

module.exports = router;