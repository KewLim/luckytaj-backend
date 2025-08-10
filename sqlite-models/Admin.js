const bcrypt = require('bcryptjs');
const dbAdapter = require('../database-adapter');

class AdminModel {
    constructor(data = {}) {
        this.id = data.id;
        this.email = data.email;
        this.password = data.password;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.lastLogin = data.lastLogin;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.mongo_id = data.mongo_id;
        
        this._isNew = !data.id; // Track if this is a new record
    }

    static async findOne(query) {
        const row = await dbAdapter.findOne('admins', query);
        return row ? new AdminModel(row) : null;
    }

    static async find(query = {}, options = {}) {
        const rows = await dbAdapter.find('admins', query, options);
        return rows.map(row => new AdminModel(row));
    }

    static async findById(id) {
        return await AdminModel.findOne({ id });
    }

    static async findByEmail(email) {
        return await AdminModel.findOne({ email });
    }

    async save() {
        // Hash password if it's new or modified
        if (this.password && (this._isNew || this._passwordModified)) {
            const salt = await bcrypt.genSalt(12);
            this.password = await bcrypt.hash(this.password, salt);
        }

        const now = new Date().toISOString();
        
        if (this._isNew) {
            // Insert new record
            this.created_at = now;
            this.updated_at = now;
            
            const data = {
                email: this.email,
                password: this.password,
                isActive: this.isActive,
                lastLogin: this.lastLogin,
                created_at: this.created_at,
                updated_at: this.updated_at,
                mongo_id: this.mongo_id
            };

            const result = await dbAdapter.insert('admins', data);
            this.id = result.id;
            this._isNew = false;
        } else {
            // Update existing record
            this.updated_at = now;
            
            const data = {
                email: this.email,
                password: this.password,
                isActive: this.isActive,
                lastLogin: this.lastLogin,
                updated_at: this.updated_at
            };

            await dbAdapter.update('admins', { id: this.id }, data);
        }
        
        return this;
    }

    async comparePassword(candidatePassword) {
        return await bcrypt.compare(candidatePassword, this.password);
    }

    // For compatibility with MongoDB ObjectId
    get _id() {
        return this.id;
    }

    // Mark password as modified
    markPasswordAsModified() {
        this._passwordModified = true;
    }

    toJSON() {
        return {
            id: this.id,
            email: this.email,
            isActive: this.isActive,
            lastLogin: this.lastLogin,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = AdminModel;