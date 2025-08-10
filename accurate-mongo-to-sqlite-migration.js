const { MongoClient } = require('mongodb');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Configuration
const MONGO_URI = 'mongodb+srv://kewlim0:jy5S2mg3LLhChCpk@luckytaj-admin-panel.t6ljpon.mongodb.net/lucky_taj_admin';
const SQLITE_PATH = '/Users/admin/Documents/luckytaj.space/lucky_taj_admin.db';

// Collections to migrate
const COLLECTIONS = [
    'admins', 'banners', 'games', 'gameconfigs', 'winners', 
    'videos', 'jackpotmessages', 'comments', 'dailygames', 'userinteractions'
];

async function connectMongo() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    return { client, db: client.db('lucky_taj_admin') };
}

function connectSQLite() {
    return new sqlite3.Database(SQLITE_PATH);
}

function createSQLiteSchema(db) {
    return new Promise((resolve, reject) => {
        const schema = fs.readFileSync('/Users/admin/Documents/luckytaj.space/accurate-sqlite-schema.sql', 'utf8');
        db.exec(schema, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function exportMongoCollection(mongoDB, collectionName) {
    console.log(`📥 Exporting ${collectionName}...`);
    const collection = mongoDB.collection(collectionName);
    const documents = await collection.find({}).toArray();
    console.log(`   Found ${documents.length} documents`);
    return documents;
}

function transformDocumentForSQLite(doc, collectionName) {
    const transformed = { ...doc };
    
    // Store original MongoDB ObjectId
    if (transformed._id) {
        transformed.mongo_id = transformed._id.toString();
        delete transformed._id;
    }
    
    // Handle version field
    if (transformed.__v !== undefined) {
        delete transformed.__v;
    }
    
    // Convert dates to ISO string format
    const dateFields = ['createdAt', 'updatedAt', 'lastLogin', 'lastRefresh', 'refreshedAt', 'timestamp'];
    dateFields.forEach(field => {
        if (transformed[field] instanceof Date || (typeof transformed[field] === 'string' && transformed[field].includes('T'))) {
            transformed[field] = new Date(transformed[field]).toISOString();
        }
    });
    
    // Collection-specific transformations
    switch (collectionName) {
        case 'games':
            // Handle recentWin object
            if (transformed.recentWin) {
                transformed.recent_win_amount = transformed.recentWin.amount;
                transformed.recent_win_player = transformed.recentWin.player;
                transformed.recent_win_comment = transformed.recentWin.comment;
                delete transformed.recentWin;
            }
            break;
            
        case 'userinteractions':
            // Handle deviceInfo object
            if (transformed.deviceInfo) {
                transformed.device_type = transformed.deviceInfo.deviceType;
                transformed.os = transformed.deviceInfo.os;
                transformed.browser = transformed.deviceInfo.browser;
                transformed.user_agent = transformed.deviceInfo.userAgent;
                delete transformed.deviceInfo;
            }
            break;
            
        case 'dailygames':
            // Convert selectedGames array to JSON string
            if (transformed.selectedGames && Array.isArray(transformed.selectedGames)) {
                transformed.selectedGames = JSON.stringify(transformed.selectedGames);
            }
            break;
    }
    
    // Rename common fields to match SQLite schema
    if (transformed.createdAt) {
        transformed.created_at = transformed.createdAt;
        delete transformed.createdAt;
    }
    if (transformed.updatedAt) {
        transformed.updated_at = transformed.updatedAt;
        delete transformed.updatedAt;
    }
    
    return transformed;
}

function insertIntoSQLite(db, tableName, documents) {
    return new Promise((resolve, reject) => {
        if (documents.length === 0) {
            resolve();
            return;
        }
        
        console.log(`📤 Inserting ${documents.length} records into ${tableName}...`);
        
        const transformed = documents.map(doc => transformDocumentForSQLite(doc, tableName));
        
        let completed = 0;
        let errors = 0;
        
        transformed.forEach((doc, index) => {
            // Get only the fields that exist in the document (excluding 'id')
            const columns = Object.keys(doc).filter(key => key !== 'id' && doc[key] !== undefined);
            const values = columns.map(col => doc[col]);
            const placeholders = columns.map(() => '?').join(',');
            
            const sql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;
            
            db.run(sql, values, function(err) {
                if (err) {
                    console.error(`Error inserting into ${tableName}:`, err.message);
                    console.error('Document:', JSON.stringify(doc, null, 2));
                    errors++;
                } else {
                    completed++;
                }
                
                if (completed + errors === transformed.length) {
                    if (errors === 0) {
                        console.log(`✅ Inserted ${completed} records into ${tableName}`);
                    } else {
                        console.log(`⚠️  Inserted ${completed} records into ${tableName} (${errors} errors)`);
                    }
                    resolve();
                }
            });
        });
    });
}

async function migrateData() {
    let mongoConnection, sqliteDb;
    
    try {
        console.log('🔌 Connecting to databases...');
        const mongoResult = await connectMongo();
        const { client: mongoClient, db: mongoDB } = mongoResult;
        mongoConnection = mongoClient;
        
        sqliteDb = connectSQLite();
        
        console.log('📋 Creating SQLite schema...');
        await createSQLiteSchema(sqliteDb);
        
        console.log('🚀 Starting data migration...');
        
        for (const collectionName of COLLECTIONS) {
            try {
                const documents = await exportMongoCollection(mongoDB, collectionName);
                await insertIntoSQLite(sqliteDb, collectionName, documents);
            } catch (err) {
                console.error(`❌ Error migrating ${collectionName}:`, err.message);
            }
        }
        
        console.log('✅ Migration completed successfully!');
        console.log(`📄 SQLite database created at: ${SQLITE_PATH}`);
        
        // Show summary
        console.log('\n📊 Database Summary:');
        for (const tableName of COLLECTIONS) {
            await new Promise((resolve) => {
                sqliteDb.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
                    if (!err) {
                        console.log(`   ${tableName}: ${row.count} records`);
                    }
                    resolve();
                });
            });
        }
        
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        if (mongoConnection) await mongoConnection.close();
        if (sqliteDb) sqliteDb.close();
    }
}

// Run migration
migrateData();