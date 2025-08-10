const path = require('path');

// Database configuration
const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'mongodb' or 'sqlite'

class ModelsFactory {
    static getModel(modelName) {
        if (DB_TYPE === 'sqlite') {
            // Use SQLite models
            return require(path.join(__dirname, 'sqlite-models', `${modelName}.js`));
        } else {
            // Use MongoDB models
            return require(path.join(__dirname, 'luckytaj-backend/models', `${modelName}.js`));
        }
    }

    static get Admin() {
        return this.getModel('Admin');
    }

    static get Banner() {
        return this.getModel('Banner');
    }

    static get Game() {
        return this.getModel('Game');
    }

    static get Winner() {
        return this.getModel('Winner');
    }

    static get Video() {
        return this.getModel('Video');
    }

    static get Comment() {
        return this.getModel('Comment');
    }

    static get GameConfig() {
        return this.getModel('GameConfig');
    }

    static get JackpotMessage() {
        return this.getModel('JackpotMessage');
    }

    static get UserInteraction() {
        return this.getModel('UserInteraction');
    }

    static get DailyGame() {
        return this.getModel('DailyGame');
    }
}

module.exports = ModelsFactory;