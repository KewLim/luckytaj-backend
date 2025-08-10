const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database configuration
const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'mongodb' or 'sqlite'
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'lucky_taj_admin.db');

class DatabaseAdapter {
    constructor() {
        this.dbType = DB_TYPE;
        this.db = null;
        this.mongoose = null;
    }

    async connect() {
        if (this.dbType === 'sqlite') {
            return this.connectSQLite();
        } else {
            return this.connectMongoDB();
        }
    }

    connectSQLite() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(SQLITE_PATH, (err) => {
                if (err) {
                    console.error('❌ SQLite connection error:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    console.log('Database path:', SQLITE_PATH);
                    resolve();
                }
            });
        });
    }

    async connectMongoDB() {
        const mongoose = require('mongoose');
        const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/luckytaj-admin';
        
        try {
            await mongoose.connect(MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                connectTimeoutMS: 10000,
                serverSelectionTimeoutMS: 5000,
            });
            console.log('✅ Connected to MongoDB');
            console.log('Database:', MONGO_URI.includes('mongodb.net') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB');
            this.mongoose = mongoose;
            return mongoose;
        } catch (err) {
            console.error('❌ MongoDB connection error:', err.message);
            throw err;
        }
    }

    // Generic query methods
    async findOne(table, query = {}) {
        if (this.dbType === 'sqlite') {
            return this.sqliteFindOne(table, query);
        } else {
            // For MongoDB, this would need to be implemented based on your models
            throw new Error('MongoDB findOne not implemented in adapter');
        }
    }

    async find(table, query = {}, options = {}) {
        if (this.dbType === 'sqlite') {
            return this.sqliteFind(table, query, options);
        } else {
            throw new Error('MongoDB find not implemented in adapter');
        }
    }

    async insert(table, data) {
        if (this.dbType === 'sqlite') {
            return this.sqliteInsert(table, data);
        } else {
            throw new Error('MongoDB insert not implemented in adapter');
        }
    }

    async update(table, query, data) {
        if (this.dbType === 'sqlite') {
            return this.sqliteUpdate(table, query, data);
        } else {
            throw new Error('MongoDB update not implemented in adapter');
        }
    }

    async delete(table, query) {
        if (this.dbType === 'sqlite') {
            return this.sqliteDelete(table, query);
        } else {
            throw new Error('MongoDB delete not implemented in adapter');
        }
    }

    // SQLite specific methods
    sqliteFindOne(table, query = {}) {
        return new Promise((resolve, reject) => {
            const whereClause = this.buildWhereClause(query);
            const sql = `SELECT * FROM ${table} ${whereClause.clause} LIMIT 1`;
            
            this.db.get(sql, whereClause.params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    sqliteFind(table, query = {}, options = {}) {
        return new Promise((resolve, reject) => {
            const whereClause = this.buildWhereClause(query);
            let sql = `SELECT * FROM ${table} ${whereClause.clause}`;
            
            if (options.limit) sql += ` LIMIT ${options.limit}`;
            if (options.offset) sql += ` OFFSET ${options.offset}`;
            if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`;
            
            this.db.all(sql, whereClause.params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    sqliteInsert(table, data) {
        return new Promise((resolve, reject) => {
            const columns = Object.keys(data).join(',');
            const placeholders = Object.keys(data).map(() => '?').join(',');
            const values = Object.values(data);
            
            const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
            
            this.db.run(sql, values, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    sqliteUpdate(table, query, data) {
        return new Promise((resolve, reject) => {
            const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
            const whereClause = this.buildWhereClause(query);
            
            const sql = `UPDATE ${table} SET ${setClause} ${whereClause.clause}`;
            const params = [...Object.values(data), ...whereClause.params];
            
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    sqliteDelete(table, query) {
        return new Promise((resolve, reject) => {
            const whereClause = this.buildWhereClause(query);
            const sql = `DELETE FROM ${table} ${whereClause.clause}`;
            
            this.db.run(sql, whereClause.params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    buildWhereClause(query) {
        if (!query || Object.keys(query).length === 0) {
            return { clause: '', params: [] };
        }
        
        const conditions = Object.keys(query).map(key => `${key} = ?`);
        const params = Object.values(query);
        
        return {
            clause: `WHERE ${conditions.join(' AND ')}`,
            params: params
        };
    }

    // Close connection
    close() {
        if (this.dbType === 'sqlite' && this.db) {
            this.db.close();
        } else if (this.mongoose) {
            this.mongoose.disconnect();
        }
    }
}

// Create a singleton instance
const dbAdapter = new DatabaseAdapter();

module.exports = dbAdapter;