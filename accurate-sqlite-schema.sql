-- Lucky Taj Admin Panel - Accurate SQLite Database Schema
-- Migration from MongoDB to SQLite based on discovered schema

PRAGMA foreign_keys = ON;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    isActive BOOLEAN DEFAULT 1,
    lastLogin DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Banners table
CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    filename TEXT,
    originalName TEXT,
    mimeType TEXT,
    size INTEGER,
    isActive BOOLEAN DEFAULT 1,
    uploadedBy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    image TEXT,
    active BOOLEAN DEFAULT 1,
    recent_win_amount TEXT,
    recent_win_player TEXT,
    recent_win_comment TEXT,
    createdBy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Game Configs table
CREATE TABLE IF NOT EXISTS gameconfigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totalGames INTEGER DEFAULT 6,
    refreshTime TEXT DEFAULT '12:00',
    lastRefresh DATETIME,
    createdBy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Winners table
CREATE TABLE IF NOT EXISTS winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    game TEXT,
    betAmount INTEGER,
    winAmount INTEGER,
    multiplier TEXT,
    quote TEXT,
    avatar TEXT,
    active BOOLEAN DEFAULT 1,
    createdBy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    videoType TEXT,
    videoUrl TEXT,
    title TEXT,
    description TEXT,
    isActive BOOLEAN DEFAULT 1,
    uploadedBy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Jackpot Messages table
CREATE TABLE IF NOT EXISTS jackpotmessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    category TEXT,
    active BOOLEAN DEFAULT 1,
    predictionTime TEXT,
    createdBy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    comment TEXT,
    avatar TEXT,
    timestamp TEXT,
    isActive BOOLEAN DEFAULT 1,
    addedBy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Daily Games table (with JSON column for selectedGames array)
CREATE TABLE IF NOT EXISTS dailygames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    selectedGames TEXT, -- JSON string
    refreshedAt DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- User Interactions table
CREATE TABLE IF NOT EXISTS userinteractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipId TEXT,
    sessionId TEXT,
    userId TEXT,
    ipAddress TEXT,
    interactionType TEXT,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    user_agent TEXT,
    timeSpentMs INTEGER,
    referrer TEXT,
    pageUrl TEXT,
    clickUrl TEXT,
    clickTarget TEXT,
    phoneNumber TEXT,
    timestamp DATETIME,
    date TEXT,
    hour INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mongo_id TEXT UNIQUE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(isActive);
CREATE INDEX IF NOT EXISTS idx_games_active ON games(active);
CREATE INDEX IF NOT EXISTS idx_winners_active ON winners(active);
CREATE INDEX IF NOT EXISTS idx_videos_active ON videos(isActive);
CREATE INDEX IF NOT EXISTS idx_jackpot_active ON jackpotmessages(active);
CREATE INDEX IF NOT EXISTS idx_comments_active ON comments(isActive);
CREATE INDEX IF NOT EXISTS idx_daily_games_date ON dailygames(date);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session ON userinteractions(sessionId);
CREATE INDEX IF NOT EXISTS idx_user_interactions_date ON userinteractions(date);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON userinteractions(interactionType);