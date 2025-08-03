const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        maxlength: 50
    },
    game: {
        type: String,
        required: true,
        maxlength: 100
    },
    betAmount: {
        type: Number,
        required: true,
        min: 0
    },
    winAmount: {
        type: Number,
        required: true,
        min: 0
    },
    multiplier: {
        type: String,
        required: true
    },
    quote: {
        type: String,
        required: true,
        maxlength: 200
    },
    avatar: {
        type: String,
        required: true,
        default: "🎰"
    },
    active: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Winner', winnerSchema);