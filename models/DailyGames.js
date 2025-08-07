const mongoose = require('mongoose');

const dailyGamesSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true // Ensure only one record per date
    },
    selectedGames: [{
        gameId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Game',
            required: true
        },
        title: String,
        image: String,
        recentWin: {
            amount: String,
            player: String,
            comment: String
        }
    }],
    refreshedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DailyGames', dailyGamesSchema);