/**
 * SHODH Memory API on Cloudflare
 * 
 * A SHODH-compatible memory layer using:
 * - D1 for metadata storage
 * - Vectorize for semantic search
 * - Workers AI for embeddings
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';

interface Env {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  API_KEY: string;
}

interface Memory {
  id: string;
  content: string;
  content_hash: string;
  memory_type: string;
  tags: string | null;
  source_type: string;
  emotion: string | null;
  emotional_valence: number | null;
  emotional_arousal: number | null;
  credibility: number;
  quality_score: number;
  access_count: number;
  last_accessed_at: string | null;
  episode_id: string | null;
  sequence_number: number | null;
  preceding_memory_id: string | null;
  created_at: string;
  updated_at: string;
}

interface RememberRequest {
  content: string;
  type?: string;
  tags?: string[];
  source_type?: string;
  emotion?: string;
  emotional_valence?: number;
  emotional_arousal?: number;
  credibility?: number;
  episode_id?: string;
  sequence_number?: number;
  preceding_memory_id?: string;
  created_at?: string;
}

interface RecallRequest {
  query: string;
  limit?: number;
  mode?: 'semantic' | 'associative' | 'hybrid';
  memory_types?: string[];
  quality_boost?: boolean;
  quality_weight?: number;
}

interface UpdateMemoryRequest {
  tags?: string[];
  type?: string;
  emotion?: string;
  emotional_valence?: number;
  emotional_arousal?: number;
  credibility?: number;
  episode_id?: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for cross-origin requests
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API Key authentication
app.use('/api/*', async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401);
  }
  const token = auth.substring(7);
  if (token !== c.env.API_KEY) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  await next();
});

// Health check (root)
app.get('/', (c) => {
  return c.json({
    service: 'shodh-cloudflare',
    status: 'healthy',
    version: '1.1.0'
  });
});

/**
 * GET /api/health - Health check (OpenAPI compliant)
 */
app.get('/api/health', (c) => {
  return c.json({
    service: 'shodh-cloudflare',
    status: 'healthy',
    version: '1.1.0',
    database: 'cloudflare-d1',
    vector_store: 'cloudflare-vectorize'
  });
});

// Generate content hash
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate embedding using Workers AI
// Using bge-small-en-v1.5 which outputs 384 dimensions (matches our Vectorize index)
async function generateEmbedding(ai: Ai, text: string): Promise<number[]> {
  const response = await ai.run('@cf/baai/bge-small-en-v1.5', {
    text: [text]
  });
  return response.data[0];
}

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * POST /api/remember - Store a new memory
 */
app.post('/api/remember', async (c) => {
  const body = await c.req.json<RememberRequest>();
  
  if (!body.content) {
    return c.json({ error: 'Content is required' }, 400);
  }

  const id = generateId();
  const contentHash = await hashContent(body.content);
  const tags = body.tags ? JSON.stringify(body.tags) : null;
  const createdAt = body.created_at || new Date().toISOString();

  // Check for duplicate
  const existing = await c.env.DB.prepare(
    'SELECT id FROM memories WHERE content_hash = ?'
  ).bind(contentHash).first();

  if (existing) {
    return c.json({ 
      success: false, 
      error: 'Memory already exists',
      existing_id: existing.id 
    }, 409);
  }

  // Generate embedding
  const embedding = await generateEmbedding(c.env.AI, body.content);

  // Store in D1
  await c.env.DB.prepare(`
    INSERT INTO memories (
      id, content, content_hash, memory_type, tags, source_type,
      emotion, emotional_valence, emotional_arousal, credibility,
      episode_id, sequence_number, preceding_memory_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.content,
    contentHash,
    body.type || 'Observation',
    tags,
    body.source_type || 'user',
    body.emotion || null,
    body.emotional_valence || null,
    body.emotional_arousal || null,
    body.credibility || 1.0,
    body.episode_id || null,
    body.sequence_number || null,
    body.preceding_memory_id || null,
    createdAt,
    createdAt
  ).run();

  // Store in Vectorize
  await c.env.VECTORIZE.upsert([{
    id: id,
    values: embedding,
    metadata: {
      content_hash: contentHash,
      memory_type: body.type || 'Observation',
      created_at: createdAt
    }
  }]);

  return c.json({
    success: true,
    id: id,
    content_hash: contentHash
  });
});

/**
 * POST /api/recall - Semantic memory search with optional quality boost
 */
app.post('/api/recall', async (c) => {
  const body = await c.req.json<RecallRequest>();

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400);
  }

  const limit = Math.min(body.limit || 5, 20);
  const qualityBoost = body.quality_boost ?? false;
  const qualityWeight = Math.min(Math.max(body.quality_weight ?? 0.3, 0), 1);

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(c.env.AI, body.query);

  // Over-fetch if quality boost is enabled (3x candidates)
  const fetchLimit = qualityBoost ? limit * 3 : limit;

  // Search Vectorize
  const vectorResults = await c.env.VECTORIZE.query(queryEmbedding, {
    topK: fetchLimit,
    returnMetadata: 'all'
  });

  if (!vectorResults.matches || vectorResults.matches.length === 0) {
    return c.json({ memories: [], count: 0 });
  }

  // Get full memory data from D1
  const ids = vectorResults.matches.map(m => m.id);
  const placeholders = ids.map(() => '?').join(',');

  const memories = await c.env.DB.prepare(`
    SELECT * FROM memories WHERE id IN (${placeholders})
  `).bind(...ids).all<Memory>();

  // Merge vector scores with memory data
  let results = vectorResults.matches.map(match => {
    const memory = memories.results?.find(m => m.id === match.id);
    if (!memory) return null;

    const semanticScore = match.score || 0;
    const qualityScore = memory.quality_score || 0.5;

    // Composite score: (1 - weight) * semantic + weight * quality
    const compositeScore = qualityBoost
      ? (1 - qualityWeight) * semanticScore + qualityWeight * qualityScore
      : semanticScore;

    return {
      ...memory,
      tags: memory.tags ? JSON.parse(memory.tags) : [],
      similarity_score: semanticScore,
      quality_score: qualityScore,
      composite_score: compositeScore
    };
  }).filter(Boolean);

  // Re-rank by composite score if quality boost enabled
  if (qualityBoost) {
    results.sort((a: any, b: any) => b.composite_score - a.composite_score);
    results = results.slice(0, limit);
  }

  // Update access counts for returned results
  const returnedIds = results.map((r: any) => r.id);
  if (returnedIds.length > 0) {
    const returnedPlaceholders = returnedIds.map(() => '?').join(',');
    await c.env.DB.prepare(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed_at = datetime('now')
      WHERE id IN (${returnedPlaceholders})
    `).bind(...returnedIds).run();
  }

  return c.json({
    memories: results,
    count: results.length,
    query: body.query,
    quality_boost: qualityBoost
  });
});

/**
 * POST /api/recall/by-tags - Tag-based memory search
 */
app.post('/api/recall/by-tags', async (c) => {
  const body = await c.req.json<{ tags: string[]; limit?: number; match_all?: boolean }>();

  if (!body.tags || body.tags.length === 0) {
    return c.json({ error: 'Tags are required' }, 400);
  }

  const limit = Math.min(body.limit || 10, 100);
  const matchAll = body.match_all ?? false;

  // Build tag conditions
  const tagConditions = body.tags.map(tag =>
    `tags LIKE '%"${tag}"%'`
  );

  const whereClause = matchAll
    ? tagConditions.join(' AND ')
    : tagConditions.join(' OR ');

  const memories = await c.env.DB.prepare(`
    SELECT * FROM memories
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all<Memory>();

  return c.json({
    memories: memories.results?.map(m => ({
      ...m,
      tags: m.tags ? JSON.parse(m.tags) : []
    })) || [],
    count: memories.results?.length || 0,
    matched_tags: body.tags
  });
});

/**
 * POST /api/recall/by-tags - Search memories by tags
 */
app.post('/api/recall/by-tags', async (c) => {
  const body = await c.req.json<{ tags: string[]; limit?: number }>();

  if (!body.tags || body.tags.length === 0) {
    return c.json({ error: 'Tags are required' }, 400);
  }

  const limit = Math.min(body.limit || 20, 100);

  // Find memories with matching tags (ANY match)
  const tagConditions = body.tags.map(tag =>
    `tags LIKE '%"${tag}"%'`
  ).join(' OR ');

  const memories = await c.env.DB.prepare(`
    SELECT * FROM memories
    WHERE ${tagConditions}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all<Memory>();

  if (!memories.results || memories.results.length === 0) {
    return c.json({ memories: [], count: 0 });
  }

  // Update access counts
  const ids = memories.results.map(m => m.id);
  const placeholders = ids.map(() => '?').join(',');

  await c.env.DB.prepare(`
    UPDATE memories
    SET access_count = access_count + 1,
        last_accessed_at = datetime('now')
    WHERE id IN (${placeholders})
  `).bind(...ids).run();

  const results = memories.results.map(m => ({
    ...m,
    tags: m.tags ? JSON.parse(m.tags) : []
  }));

  return c.json({
    memories: results,
    count: results.length
  });
});

/**
 * GET /api/memories - List all memories
 */
app.get('/api/memories', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const memoryType = c.req.query('type');

  let query = 'SELECT * FROM memories';
  const params: any[] = [];

  if (memoryType) {
    query += ' WHERE memory_type = ?';
    params.push(memoryType);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const memories = await c.env.DB.prepare(query).bind(...params).all<Memory>();

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM memories'
  ).first<{ count: number }>();

  return c.json({
    memories: memories.results?.map(m => ({
      ...m,
      tags: m.tags ? JSON.parse(m.tags) : []
    })) || [],
    count: memories.results?.length || 0,
    total: countResult?.count || 0
  });
});

/**
 * GET /api/memories/:id - Get a specific memory
 */
app.get('/api/memories/:id', async (c) => {
  const id = c.req.param('id');

  const memory = await c.env.DB.prepare(
    'SELECT * FROM memories WHERE id = ?'
  ).bind(id).first<Memory>();

  if (!memory) {
    return c.json({ error: 'Memory not found' }, 404);
  }

  return c.json({
    ...memory,
    tags: memory.tags ? JSON.parse(memory.tags) : []
  });
});

/**
 * PATCH /api/memories/:id - Update memory metadata
 */
app.patch('/api/memories/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<UpdateMemoryRequest>();

  // Check if memory exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM memories WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Memory not found' }, 404);
  }

  // Build dynamic update query
  const updates: string[] = [];
  const values: any[] = [];

  if (body.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(body.tags));
  }
  if (body.type !== undefined) {
    updates.push('memory_type = ?');
    values.push(body.type);
  }
  if (body.emotion !== undefined) {
    updates.push('emotion = ?');
    values.push(body.emotion);
  }
  if (body.emotional_valence !== undefined) {
    updates.push('emotional_valence = ?');
    values.push(body.emotional_valence);
  }
  if (body.emotional_arousal !== undefined) {
    updates.push('emotional_arousal = ?');
    values.push(body.emotional_arousal);
  }
  if (body.credibility !== undefined) {
    updates.push('credibility = ?');
    values.push(body.credibility);
  }
  if (body.episode_id !== undefined) {
    updates.push('episode_id = ?');
    values.push(body.episode_id);
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = datetime(\'now\')');
  values.push(id);

  await c.env.DB.prepare(`
    UPDATE memories
    SET ${updates.join(', ')}
    WHERE id = ?
  `).bind(...values).run();

  // Return updated memory
  const updated = await c.env.DB.prepare(
    'SELECT * FROM memories WHERE id = ?'
  ).bind(id).first<Memory>();

  return c.json({
    success: true,
    memory: {
      ...updated,
      tags: updated?.tags ? JSON.parse(updated.tags) : []
    }
  });
});

/**
 * DELETE /api/forget/:id - Delete a memory
 */
app.delete('/api/forget/:id', async (c) => {
  const id = c.req.param('id');

  // Delete from D1
  const result = await c.env.DB.prepare(
    'DELETE FROM memories WHERE id = ?'
  ).bind(id).run();

  // Delete from Vectorize
  await c.env.VECTORIZE.deleteByIds([id]);

  // Delete related edges
  await c.env.DB.prepare(
    'DELETE FROM memory_edges WHERE source_id = ? OR target_id = ?'
  ).bind(id, id).run();

  return c.json({
    success: true,
    deleted: result.meta.changes > 0
  });
});

/**
 * POST /api/forget/by-tags - Delete memories by tags
 */
app.post('/api/forget/by-tags', async (c) => {
  const body = await c.req.json<{ tags: string[] }>();
  
  if (!body.tags || body.tags.length === 0) {
    return c.json({ error: 'Tags are required' }, 400);
  }

  // Find memories with matching tags
  const tagConditions = body.tags.map(tag => 
    `tags LIKE '%"${tag}"%'`
  ).join(' OR ');

  const memories = await c.env.DB.prepare(`
    SELECT id FROM memories WHERE ${tagConditions}
  `).all<{ id: string }>();

  if (!memories.results || memories.results.length === 0) {
    return c.json({ success: true, deleted_count: 0 });
  }

  const ids = memories.results.map(m => m.id);
  const placeholders = ids.map(() => '?').join(',');

  // Delete from D1
  await c.env.DB.prepare(`
    DELETE FROM memories WHERE id IN (${placeholders})
  `).bind(...ids).run();

  // Delete from Vectorize
  await c.env.VECTORIZE.deleteByIds(ids);

  return c.json({
    success: true,
    deleted_count: ids.length
  });
});

/**
 * GET /api/tags - Get all unique tags
 */
app.get('/api/tags', async (c) => {
  const memories = await c.env.DB.prepare(
    'SELECT DISTINCT tags FROM memories WHERE tags IS NOT NULL'
  ).all<{ tags: string }>();

  const allTags = new Set<string>();
  memories.results?.forEach(m => {
    const tags = JSON.parse(m.tags);
    tags.forEach((tag: string) => allTags.add(tag));
  });

  return c.json({
    tags: Array.from(allTags).sort(),
    count: allTags.size
  });
});

/**
 * GET /api/stats - Memory statistics
 */
app.get('/api/stats', async (c) => {
  const totalResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM memories'
  ).first<{ count: number }>();

  const typeStats = await c.env.DB.prepare(`
    SELECT memory_type, COUNT(*) as count 
    FROM memories 
    GROUP BY memory_type
  `).all<{ memory_type: string; count: number }>();

  const recentResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as count 
    FROM memories 
    WHERE created_at > datetime('now', '-7 days')
  `).first<{ count: number }>();

  return c.json({
    total_memories: totalResult?.count || 0,
    memories_last_7_days: recentResult?.count || 0,
    by_type: typeStats.results || [],
    database: 'cloudflare-d1',
    vector_store: 'cloudflare-vectorize'
  });
});

/**
 * POST /api/context - Proactive context (like SHODH's proactive_context)
 */
app.post('/api/context', async (c) => {
  const body = await c.req.json<{
    context: string;
    max_results?: number;
    auto_ingest?: boolean;
  }>();

  if (!body.context) {
    return c.json({ error: 'Context is required' }, 400);
  }

  const limit = Math.min(body.max_results || 5, 20);
  const autoIngest = body.auto_ingest !== false;

  // Search for relevant memories
  const queryEmbedding = await generateEmbedding(c.env.AI, body.context);
  const vectorResults = await c.env.VECTORIZE.query(queryEmbedding, {
    topK: limit,
    returnMetadata: 'all'
  });

  let memories: any[] = [];
  if (vectorResults.matches && vectorResults.matches.length > 0) {
    const ids = vectorResults.matches.map(m => m.id);
    const placeholders = ids.map(() => '?').join(',');
    
    const dbResults = await c.env.DB.prepare(`
      SELECT * FROM memories WHERE id IN (${placeholders})
    `).bind(...ids).all<Memory>();

    memories = vectorResults.matches.map(match => {
      const memory = dbResults.results?.find(m => m.id === match.id);
      return {
        ...memory,
        tags: memory?.tags ? JSON.parse(memory.tags) : [],
        relevance_score: match.score
      };
    }).filter(Boolean);
  }

  // Auto-ingest the context as a Conversation memory
  let ingestedId = null;
  if (autoIngest) {
    const id = generateId();
    const contentHash = await hashContent(body.context);
    const now = new Date().toISOString();

    // Check if not duplicate
    const existing = await c.env.DB.prepare(
      'SELECT id FROM memories WHERE content_hash = ?'
    ).bind(contentHash).first();

    if (!existing) {
      const embedding = await generateEmbedding(c.env.AI, body.context);

      await c.env.DB.prepare(`
        INSERT INTO memories (id, content, content_hash, memory_type, created_at, updated_at)
        VALUES (?, ?, ?, 'Conversation', ?, ?)
      `).bind(id, body.context, contentHash, now, now).run();

      await c.env.VECTORIZE.upsert([{
        id: id,
        values: embedding,
        metadata: { content_hash: contentHash, memory_type: 'Conversation', created_at: now }
      }]);

      ingestedId = id;
    }
  }

  return c.json({
    surfaced_memories: memories,
    count: memories.length,
    ingested: autoIngest,
    ingested_id: ingestedId
  });
});

/**
 * POST /api/consolidate - Trigger memory consolidation
 *
 * Performs basic consolidation:
 * - Applies exponential decay to quality scores
 * - Archives low-quality old memories (soft delete)
 * - Returns consolidation statistics
 */
app.post('/api/consolidate', async (c) => {
  const body = await c.req.json<{
    time_horizon?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    decay_rate?: number;
    quality_threshold?: number;
  }>();

  const timeHorizon = body.time_horizon || 'weekly';
  const decayRate = body.decay_rate ?? 0.95;
  const qualityThreshold = body.quality_threshold ?? 0.1;

  // Calculate days based on time horizon
  const daysMap: Record<string, number> = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    yearly: 365
  };
  const days = daysMap[timeHorizon] || 7;

  // Get memories older than the time horizon that haven't been accessed recently
  const oldMemories = await c.env.DB.prepare(`
    SELECT id, quality_score, access_count, created_at, last_accessed_at
    FROM memories
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `).bind(days).all<{
    id: string;
    quality_score: number;
    access_count: number;
    created_at: string;
    last_accessed_at: string | null;
  }>();

  let decayed = 0;
  let archived = 0;

  if (oldMemories.results && oldMemories.results.length > 0) {
    for (const memory of oldMemories.results) {
      // Apply exponential decay to quality score
      const newQuality = (memory.quality_score || 0.5) * decayRate;

      if (newQuality < qualityThreshold) {
        // Archive (delete) very low quality memories
        await c.env.DB.prepare('DELETE FROM memories WHERE id = ?').bind(memory.id).run();
        await c.env.VECTORIZE.deleteByIds([memory.id]);
        archived++;
      } else {
        // Update decayed quality score
        await c.env.DB.prepare(`
          UPDATE memories SET quality_score = ?, updated_at = datetime('now') WHERE id = ?
        `).bind(newQuality, memory.id).run();
        decayed++;
      }
    }
  }

  return c.json({
    success: true,
    time_horizon: timeHorizon,
    processed: oldMemories.results?.length || 0,
    decayed: decayed,
    archived: archived,
    decay_rate: decayRate,
    quality_threshold: qualityThreshold
  });
});

/**
 * POST /api/reindex - Re-index all memories in Vectorize
 */
app.post('/api/reindex', async (c) => {
  const memories = await c.env.DB.prepare(
    'SELECT id, content, memory_type, created_at, content_hash FROM memories'
  ).all<{ id: string; content: string; memory_type: string; created_at: string; content_hash: string }>();

  if (!memories.results || memories.results.length === 0) {
    return c.json({ success: true, reindexed: 0 });
  }

  let reindexed = 0;
  const batchSize = 10;
  
  for (let i = 0; i < memories.results.length; i += batchSize) {
    const batch = memories.results.slice(i, i + batchSize);
    const vectors = [];
    
    for (const memory of batch) {
      try {
        const embedding = await generateEmbedding(c.env.AI, memory.content);
        vectors.push({
          id: memory.id,
          values: embedding,
          metadata: {
            content_hash: memory.content_hash,
            memory_type: memory.memory_type,
            created_at: memory.created_at
          }
        });
        reindexed++;
      } catch (e) {
        console.error(`Failed to embed memory ${memory.id}:`, e);
      }
    }
    
    if (vectors.length > 0) {
      await c.env.VECTORIZE.upsert(vectors);
    }
  }

  return c.json({
    success: true,
    reindexed: reindexed,
    total: memories.results.length
  });
});

/**
 * POST /api/consolidate - Memory consolidation
 */
app.post('/api/consolidate', async (c) => {
  const body = await c.req.json<{
    time_horizon: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  }>();

  if (!body.time_horizon) {
    return c.json({ error: 'time_horizon is required' }, 400);
  }

  // Map time horizon to days
  const horizonDays: Record<string, number> = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    yearly: 365
  };

  const days = horizonDays[body.time_horizon];
  if (!days) {
    return c.json({ error: 'Invalid time_horizon' }, 400);
  }

  // Get memories within the time horizon
  const memories = await c.env.DB.prepare(`
    SELECT id, content, tags, quality_score, access_count, created_at
    FROM memories
    WHERE created_at > datetime('now', '-' || ? || ' days')
  `).bind(days).all<{
    id: string;
    content: string;
    tags: string | null;
    quality_score: number;
    access_count: number;
    created_at: string;
  }>();

  if (!memories.results || memories.results.length === 0) {
    return c.json({
      success: true,
      processed: 0,
      archived: 0,
      associations_created: 0
    });
  }

  let processed = 0;
  let archived = 0;
  let associationsCreated = 0;

  // Identify low-quality memories for archival
  // (quality_score < 0.3 and access_count < 2)
  const lowQualityMemories = memories.results.filter(
    m => m.quality_score < 0.3 && m.access_count < 2
  );

  // Archive low-quality memories by adding an 'archived' tag
  for (const memory of lowQualityMemories) {
    const tags = memory.tags ? JSON.parse(memory.tags) : [];
    if (!tags.includes('archived')) {
      tags.push('archived');
      await c.env.DB.prepare(`
        UPDATE memories
        SET tags = ?, quality_score = 0.1
        WHERE id = ?
      `).bind(JSON.stringify(tags), memory.id).run();
      archived++;
    }
  }

  // Create associations between memories with shared tags
  const tagGroups = new Map<string, string[]>();

  for (const memory of memories.results) {
    if (!memory.tags) continue;
    const tags = JSON.parse(memory.tags);

    for (const tag of tags) {
      if (tag === 'archived') continue;
      if (!tagGroups.has(tag)) {
        tagGroups.set(tag, []);
      }
      tagGroups.get(tag)!.push(memory.id);
    }
  }

  // Create edges for memories sharing tags (basic Hebbian association)
  for (const [tag, memoryIds] of tagGroups) {
    if (memoryIds.length < 2) continue;

    // Create edges between memories with shared tags
    for (let i = 0; i < memoryIds.length - 1; i++) {
      for (let j = i + 1; j < memoryIds.length; j++) {
        const sourceId = memoryIds[i];
        const targetId = memoryIds[j];

        // Check if edge exists
        const existing = await c.env.DB.prepare(`
          SELECT weight, co_activations FROM memory_edges
          WHERE source_id = ? AND target_id = ?
        `).bind(sourceId, targetId).first<{ weight: number; co_activations: number }>();

        if (existing) {
          // Strengthen existing edge
          await c.env.DB.prepare(`
            UPDATE memory_edges
            SET weight = weight + 0.1,
                co_activations = co_activations + 1,
                updated_at = datetime('now')
            WHERE source_id = ? AND target_id = ?
          `).bind(sourceId, targetId).run();
        } else {
          // Create new edge
          await c.env.DB.prepare(`
            INSERT INTO memory_edges (source_id, target_id, weight, co_activations)
            VALUES (?, ?, 1.0, 1)
          `).bind(sourceId, targetId).run();
          associationsCreated++;
        }
      }
    }
  }

  processed = memories.results.length;

  return c.json({
    success: true,
    processed,
    archived,
    associations_created: associationsCreated
  });
});

export default app;
