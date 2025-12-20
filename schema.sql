-- SHODH Cloudflare D1 Schema
-- Run with: npx wrangler d1 execute shodh-memory --file=./schema.sql

-- Memory metadata table
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash TEXT UNIQUE NOT NULL,
    memory_type TEXT DEFAULT 'Observation',
    tags TEXT,
    source_type TEXT DEFAULT 'user',
    emotion TEXT,
    emotional_valence REAL,
    emotional_arousal REAL,
    credibility REAL DEFAULT 1.0,
    quality_score REAL DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    episode_id TEXT,
    sequence_number INTEGER,
    preceding_memory_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- For Hebbian-style edge strengthening
CREATE TABLE IF NOT EXISTS memory_edges (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    co_activations INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (source_id, target_id),
    FOREIGN KEY (source_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_episode ON memories(episode_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON memory_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON memory_edges(target_id);
