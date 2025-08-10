const dbAdapter = require('../database-adapter');

class GameModel {
    constructor(data = {}) {
        this.id = data.id;
        this.title = data.title;
        this.name = data.name || data.title; // For compatibility
        this.image = data.image;
        this.active = data.active !== undefined ? data.active : true;
        this.is_active = data.is_active !== undefined ? data.is_active : data.active; // Alternative naming
        this.recent_win_amount = data.recent_win_amount;
        this.recent_win_player = data.recent_win_player;
        this.recent_win_comment = data.recent_win_comment;
        this.createdBy = data.createdBy;
        this.created_by = data.created_by;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.mongo_id = data.mongo_id;
        
        // Handle recentWin object for compatibility
        if (data.recentWin) {
            this.recent_win_amount = data.recentWin.amount;
            this.recent_win_player = data.recentWin.player;
            this.recent_win_comment = data.recentWin.comment;
        }
        
        this._isNew = !data.id;
    }

    static async findOne(query) {
        const row = await dbAdapter.findOne('games', query);
        return row ? new GameModel(row) : null;
    }

    static async find(query = {}, options = {}) {
        const rows = await dbAdapter.find('games', query, options);
        return rows.map(row => new GameModel(row));
    }

    static async findById(id) {
        return await GameModel.findOne({ id });
    }

    async save() {
        const now = new Date().toISOString();
        
        if (this._isNew) {
            this.created_at = now;
            this.updated_at = now;
            
            const data = {
                title: this.title,
                image: this.image,
                active: this.active,
                recent_win_amount: this.recent_win_amount,
                recent_win_player: this.recent_win_player,
                recent_win_comment: this.recent_win_comment,
                createdBy: this.createdBy,
                created_at: this.created_at,
                updated_at: this.updated_at,
                mongo_id: this.mongo_id
            };

            const result = await dbAdapter.insert('games', data);
            this.id = result.id;
            this._isNew = false;
        } else {
            this.updated_at = now;
            
            const data = {
                title: this.title,
                image: this.image,
                active: this.active,
                recent_win_amount: this.recent_win_amount,
                recent_win_player: this.recent_win_player,
                recent_win_comment: this.recent_win_comment,
                createdBy: this.createdBy,
                updated_at: this.updated_at
            };

            await dbAdapter.update('games', { id: this.id }, data);
        }
        
        return this;
    }

    async remove() {
        if (this.id) {
            await dbAdapter.delete('games', { id: this.id });
        }
    }

    get _id() {
        return this.id;
    }

    // Getter for recentWin object (for compatibility)
    get recentWin() {
        if (this.recent_win_amount || this.recent_win_player || this.recent_win_comment) {
            return {
                amount: this.recent_win_amount,
                player: this.recent_win_player,
                comment: this.recent_win_comment
            };
        }
        return null;
    }

    toJSON() {
        const json = {
            id: this.id,
            _id: this.id, // For compatibility
            title: this.title,
            image: this.image,
            active: this.active,
            createdBy: this.createdBy,
            created_at: this.created_at,
            updated_at: this.updated_at
        };

        // Add recentWin if exists
        if (this.recentWin) {
            json.recentWin = this.recentWin;
        }

        return json;
    }
}

module.exports = GameModel;