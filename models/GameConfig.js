const mongoose = require('mongoose');

const gameConfigSchema = new mongoose.Schema({
    totalGames: {
        type: Number,
        default: 6,
        min: 3,
        max: 12
    },
    refreshTime: {
        type: String,
        default: '12:00',
        required: true
    },
    lastRefresh: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('GameConfig', gameConfigSchema);