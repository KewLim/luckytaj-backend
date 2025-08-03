const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    avatar: {
        type: String,
        default: '🎮'
    },
    timestamp: {
        type: String,
        default: function() {
            const timeOptions = ['2 mins ago', '5 mins ago', '10 mins ago', '15 mins ago', '30 mins ago', '1 hour ago'];
            return timeOptions[Math.floor(Math.random() * timeOptions.length)];
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

// Index for active comments
commentSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);