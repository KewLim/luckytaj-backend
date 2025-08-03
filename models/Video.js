const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    videoType: {
        type: String,
        required: true,
        enum: ['youtube', 'mp4']
    },
    videoUrl: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    isActive: {
        type: Boolean,
        default: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

// Allow multiple active videos - removed single active video restriction

module.exports = mongoose.model('Video', videoSchema);