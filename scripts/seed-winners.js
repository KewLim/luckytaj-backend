const mongoose = require('mongoose');
require('dotenv').config();

const Winner = require('../models/Winner');
const Admin = require('../models/Admin');

async function seedWinners() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');

        // Find admin user to use as createdBy
        const admin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
        if (!admin) {
            console.error('Admin user not found. Please run setup-admin.js first.');
            process.exit(1);
        }

        // Clear existing winners
        await Winner.deleteMany({});
        console.log('Cleared existing winners');

        // Default winner data matching the hardcoded data
        const winnerData = [
            {
                username: "Lucky****2",
                game: "Jili Boxing King",
                betAmount: 500,
                winAmount: 24000,
                multiplier: "48x",
                quote: "Bhai full paisa vasool ho gaya aaj!",
                avatar: "👑",
                createdBy: admin._id
            },
            {
                username: "Meena****n",
                game: "BNG Three China Pots",
                betAmount: 1000,
                winAmount: 32000,
                multiplier: "32x",
                quote: "Aaj toh lag raha hai mera din hai!",
                avatar: "💎",
                createdBy: admin._id
            },
            {
                username: "Vikram****i",
                game: "Evolution Crazy Time",
                betAmount: 750,
                winAmount: 18000,
                multiplier: "24x",
                quote: "Arre yaar itna paisa dekh kar khushi se jump kar raha hu!",
                avatar: "🔥",
                createdBy: admin._id
            },
            {
                username: "Pooja****y",
                game: "Crazy Time",
                betAmount: 2000,
                winAmount: 50000,
                multiplier: "25x",
                quote: "Main toh pagal ho gayi hu khushi se!",
                avatar: "⭐",
                createdBy: admin._id
            }
        ];

        // Insert winners
        const winners = await Winner.insertMany(winnerData);
        console.log(`✅ Successfully added ${winners.length} winners:`);
        winners.forEach(winner => {
            console.log(`- ${winner.username}: ₹${winner.winAmount.toLocaleString()} from ${winner.game}`);
        });
        
    } catch (error) {
        console.error('Error seeding winners:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

seedWinners();