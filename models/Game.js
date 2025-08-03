const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    image: {
        type: String,
        required: true // Image filename from images folder
    },
    active: {
        type: Boolean,
        default: true
    },
    recentWin: {
        amount: {
            type: String,
            required: true,
            default: '$5,000'
        },
        player: {
            type: String,
            required: true,
            default: 'Lucky***Player'
        },
        comment: {
            type: String,
            required: true,
            maxlength: 300,
            default: 'Amazing game! Just won big!'
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Game', gameSchema);