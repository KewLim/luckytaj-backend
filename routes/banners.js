const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const Banner = require('../models/Banner');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Configure multer for banner uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/banners/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
        }
    }
});

// Get all banners
router.get('/', authMiddleware, async (req, res) => {
    try {
        const banners = await Banner.find()
            .populate('uploadedBy', 'email')
            .sort({ createdAt: -1 });
        
        res.json(banners);
    } catch (error) {
        console.error('Get banners error:', error);
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

// Upload new banner
router.post('/', authMiddleware, upload.single('banner'), [
    body('title').optional().trim().isLength({ max: 200 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid input', details: errors.array() });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const banner = new Banner({
            title: req.body.title || '',
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.admin._id
        });

        await banner.save();
        await banner.populate('uploadedBy', 'email');

        res.status(201).json({
            message: 'Banner uploaded successfully',
            banner
        });
    } catch (error) {
        console.error('Banner upload error:', error);
        res.status(500).json({ error: 'Failed to upload banner' });
    }
});

// Update banner
router.patch('/:id', authMiddleware, [
    body('title').optional().trim().isLength({ max: 200 }),
    body('isActive').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid input', details: errors.array() });
        }

        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ error: 'Banner not found' });
        }

        // Update allowed fields
        if (req.body.title !== undefined) banner.title = req.body.title;
        if (req.body.isActive !== undefined) banner.isActive = req.body.isActive;

        await banner.save();
        await banner.populate('uploadedBy', 'email');

        res.json({
            message: 'Banner updated successfully',
            banner
        });
    } catch (error) {
        console.error('Banner update error:', error);
        res.status(500).json({ error: 'Failed to update banner' });
    }
});

// Delete banner
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ error: 'Banner not found' });
        }

        // Delete file from filesystem
        try {
            await fs.unlink(path.join('uploads/banners', banner.filename));
        } catch (fileError) {
            console.warn('Failed to delete file:', fileError.message);
        }

        // Delete from database
        await Banner.findByIdAndDelete(req.params.id);

        res.json({ message: 'Banner deleted successfully' });
    } catch (error) {
        console.error('Banner delete error:', error);
        res.status(500).json({ error: 'Failed to delete banner' });
    }
});

module.exports = router;