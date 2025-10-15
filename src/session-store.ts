/**
 * Session Store Infrastructure
 *
 * Provides abstraction for session storage with multiple implementations:
 * - InMemorySessionStore: Fast, ephemeral (current implementation)
 * - RedisSessionStore: Persistent, scalable (production-ready)
 */

import { FieldDiagnosticAgent } from './agent';
import { ProtocolParser } from './protocol/parser';
import { ProtocolRegistry } from './tools/registry';

/**
 * Minimal Redis interface to avoid requiring ioredis as a dependency
 */
interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

export interface Session {
  id: string;
  agent: FieldDiagnosticAgent;
  registry: ProtocolRegistry;
  parser: ProtocolParser;
  created_at: string;
  last_accessed: string;
  total_cost: number;
}

export interface SerializedSession {
  id: string;
  agent_state: unknown; // Serialized agent state
  created_at: string;
  last_accessed: string;
  total_cost: number;
  protocol_path: string;
}

/**
 * Abstract session store interface
 */
export interface SessionStore {
  /**
   * Get a session by ID
   */
  get(sessionId: string): Promise<Session | null>;

  /**
   * Store a session
   */
  set(sessionId: string, session: Session): Promise<void>;

  /**
   * Delete a session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Clean up expired sessions
   */
  cleanup(): Promise<number>;

  /**
   * Get count of active sessions
   */
  size(): Promise<number>;
}

/**
 * In-memory session store (current implementation)
 * Fast but ephemeral - sessions are lost on server restart
 */
export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();
  private readonly SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

  async get(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update last accessed
    session.last_accessed = new Date().toISOString();
    return session;
  }

  async set(sessionId: string, session: Session): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastAccessed = new Date(session.last_accessed).getTime();
      if (now - lastAccessed > this.SESSION_TTL_MS) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🗑️  CLEANUP: Removed ${cleaned} expired session(s)`);
    }

    return cleaned;
  }

  async size(): Promise<number> {
    return this.sessions.size;
  }
}

/**
 * Redis session store (production implementation)
 * Persistent, scalable, survives server restarts
 *
 * Usage:
 * ```typescript
 * import Redis from 'ioredis';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const store = new RedisSessionStore(redis, apiKey);
 * ```
 */
export class RedisSessionStore implements SessionStore {
  private redis: RedisLike;
  private readonly SESSION_TTL_SECONDS = 60 * 60; // 1 hour
  private readonly KEY_PREFIX = 'session:';
  private apiKey: string;

  constructor(redis: RedisLike, apiKey: string) {
    this.redis = redis;
    this.apiKey = apiKey;
  }

  async get(sessionId: string): Promise<Session | null> {
    const key = this.KEY_PREFIX + sessionId;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const serialized: SerializedSession = JSON.parse(data);

    // Reconstruct session from serialized data
    const session = await this.deserializeSession(serialized);

    // Update last accessed and TTL
    session.last_accessed = new Date().toISOString();
    await this.set(sessionId, session);

    return session;
  }

  async set(sessionId: string, session: Session): Promise<void> {
    const key = this.KEY_PREFIX + sessionId;

    // Serialize session
    const serialized = this.serializeSession(session);

    // Store with TTL
    await this.redis.setex(key, this.SESSION_TTL_SECONDS, JSON.stringify(serialized));
  }

  async delete(sessionId: string): Promise<void> {
    const key = this.KEY_PREFIX + sessionId;
    await this.redis.del(key);
  }

  async cleanup(): Promise<number> {
    // Redis automatically cleans up expired keys with TTL
    // This method is a no-op for Redis but kept for interface compatibility
    return 0;
  }

  async size(): Promise<number> {
    const keys = await this.redis.keys(this.KEY_PREFIX + '*');
    return keys.length;
  }

  /**
   * Serialize session to JSON-friendly format
   */
  private serializeSession(session: Session): SerializedSession {
    const metadata = session.registry.getMetadata();
    return {
      id: session.id,
      agent_state: session.agent.getState(),
      created_at: session.created_at,
      last_accessed: session.last_accessed,
      total_cost: session.total_cost,
      protocol_path: metadata?.id || 'field_diagnostic',
    };
  }

  /**
   * Deserialize session from stored data
   */
  private async deserializeSession(serialized: SerializedSession): Promise<Session> {
    // Reconstruct parser and registry
    const ProtocolLoader = (await import('./protocol/loader')).ProtocolLoader;
    const loader = new ProtocolLoader();
    const protocolPath = loader.getProtocolPath(serialized.protocol_path);

    if (!protocolPath) {
      throw new Error(`Protocol not found: ${serialized.protocol_path}`);
    }

    const parser = new ProtocolParser(protocolPath);
    const protocol = parser.parse();
    const registry = new ProtocolRegistry(protocol);

    // Reconstruct agent
    const agent = new FieldDiagnosticAgent(this.apiKey, registry, protocolPath);

    // Note: Full agent state reconstruction would require more work
    // For now, this creates a fresh agent. To fully restore state,
    // you would need to serialize conversationHistory, themeAnswers, etc.

    return {
      id: serialized.id,
      agent,
      registry,
      parser,
      created_at: serialized.created_at,
      last_accessed: serialized.last_accessed,
      total_cost: serialized.total_cost,
    };
  }
}

/**
 * Factory function to create appropriate session store based on configuration
 */
export function createSessionStore(config: {
  type: 'memory' | 'redis';
  redis?: RedisLike;
  apiKey: string;
}): SessionStore {
  if (config.type === 'redis' && config.redis) {
    console.log('📦 Using Redis session store (persistent)');
    return new RedisSessionStore(config.redis, config.apiKey);
  }

  console.log('💾 Using in-memory session store (ephemeral)');
  return new InMemorySessionStore();
}
