const mongoose = require('mongoose');

const jackpotMessageSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        maxlength: 200
    },
    category: {
        type: String,
        required: true,
        enum: ['Dragon Tiger', 'BNG Slot', 'Fishing Games', 'Crazy Time', 'PG Slots', 'Jili Games', 'Live Casino']
    },
    predictionTime: {
        type: String,
        required: true,
        enum: ['2:00', '10:00', '17:00']
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

module.exports = mongoose.model('JackpotMessage', jackpotMessageSchema);