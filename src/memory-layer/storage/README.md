# Memory Layer Storage

Phase 2 storage components for the Memory Layer.

## Components

### 1. Memory Store Interface (`memory-store-interface.ts`)

Defines the storage abstraction for all memory operations.

**Interface Methods:**

```typescript
interface MemoryStore {
  // Store a new memory record
  store(record: MemoryRecord): Promise<MemoryRecord>;

  // Recall (query) memory records with filters
  recall(query: RecallQuery): Promise<MemoryRecord[]>;

  // Forget (delete) memory records
  forget(request: ForgetRequest): Promise<string[]>;

  // Count records matching filters
  count(filters: QueryFilters): Promise<number>;

  // Get a single record by ID
  get(id: string): Promise<MemoryRecord | null>;

  // Increment access count
  incrementAccessCount(id: string): Promise<MemoryRecord | null>;

  // Check if record exists
  exists(id: string): Promise<boolean>;

  // Clear expired records (TTL enforcement)
  clearExpired(): Promise<number>;

  // Get storage statistics
  getStats(): Promise<{
    total_records: number;
    records_by_family: Record<string, number>;
    storage_bytes: number;
  }>;

  // Clear all records (testing only)
  clear(): Promise<void>;
}
```

### 2. In-Memory Storage Adapter (`in-memory-store.ts`)

Production-ready in-memory implementation of MemoryStore interface.

**Features:**

- Fast CRUD operations with O(1) lookups
- Indexing by `user_id`, `session_id`, `consent_family`
- TTL enforcement with `expires_at`
- Consent family privacy enforcement
- K-anonymity support (minimum 5 records for cohort/population)
- Automatic access count tracking
- Storage statistics and metrics

**Usage:**

```typescript
import { getMemoryStore } from './storage/in-memory-store';

const store = getMemoryStore();

// Store a record
const record = await store.store({
  id: uuid(),
  user_id: 'user_123',
  content: {
    type: 'text',
    data: 'User preferences for dark mode',
  },
  consent_family: 'personal',
  consent_timestamp: new Date().toISOString(),
  consent_version: '1.0',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  access_count: 0,
  audit_receipt_id: 'rcpt_abc',
});

// Recall records
const records = await store.recall({
  user_id: 'user_123',
  limit: 10,
  sort: 'desc',
});

// Forget records
const deletedIds = await store.forget({
  user_id: 'user_123',
});

// Get stats
const stats = await store.getStats();
console.log(stats);
// {
//   total_records: 1543,
//   records_by_family: {
//     personal: 1200,
//     cohort: 300,
//     population: 43
//   },
//   storage_bytes: 2457600
// }
```

## Indexing Strategy

The in-memory store uses three indexes for fast queries:

1. **User ID Index:** `Map<user_id, Set<record_id>>`
   - Fast lookup of all records for a user
   - Used by `recall` and `forget` operations

2. **Session ID Index:** `Map<session_id, Set<record_id>>`
   - Fast lookup of records within a session
   - Used for session-scoped recall queries

3. **Consent Family Index:** `Map<consent_family, Set<record_id>>`
   - Fast lookup by consent level
   - Used for distill operations

## Privacy Enforcement

### Personal Family

- Full CRUD access
- All fields visible
- No restrictions

### Cohort Family

- Store: Allowed (anonymized on write)
- Recall: Denied (returns empty array)
- Distill: Allowed (aggregates only)
- Forget: Anonymization (content deleted, metadata retained)
- Export: Anonymized (no `user_id`, `session_id`)

### Population Family

- Store: Allowed (aggregated on write)
- Recall: Denied (returns empty array)
- Distill: Allowed (population-level aggregates)
- Forget: Denied (403 Forbidden)
- Export: Denied (403 Forbidden)

## K-Anonymity Enforcement

For cohort and population queries, the store enforces k-anonymity:

```typescript
const K_ANONYMITY_MIN = 5; // Minimum records required
```

Queries returning fewer than 5 records are rejected to prevent re-identification.

## TTL (Time-To-Live) Enforcement

Records with `expires_at` set are automatically filtered:

```typescript
// Clear expired records
const deletedCount = await store.clearExpired();
```

**Recommended:** Run `clearExpired()` periodically (e.g., every 1 hour):

```typescript
setInterval(
  async () => {
    const count = await store.clearExpired();
    if (count > 0) {
      console.log(`Cleared ${count} expired records`);
    }
  },
  60 * 60 * 1000
); // Every hour
```

## Query Filters

The `recall` method supports comprehensive filtering:

```typescript
interface RecallQuery {
  user_id: string; // Required: user to query
  session_id?: string; // Optional: filter by session
  since?: string; // Optional: created_at >= timestamp
  until?: string; // Optional: created_at <= timestamp
  type?: ContentType; // Optional: filter by content type
  limit?: number; // Optional: max results (default: 100)
  offset?: number; // Optional: pagination offset (default: 0)
  sort?: 'asc' | 'desc'; // Optional: sort order (default: 'desc')
}
```

**Examples:**

```typescript
// Get latest 10 text memories
const recent = await store.recall({
  user_id: 'user_123',
  type: 'text',
  limit: 10,
  sort: 'desc',
});

// Get memories from specific session
const session = await store.recall({
  user_id: 'user_123',
  session_id: 'sess_abc',
});

// Get memories in date range
const range = await store.recall({
  user_id: 'user_123',
  since: '2025-10-01T00:00:00Z',
  until: '2025-10-31T23:59:59Z',
});

// Pagination
const page1 = await store.recall({
  user_id: 'user_123',
  limit: 20,
  offset: 0,
});

const page2 = await store.recall({
  user_id: 'user_123',
  limit: 20,
  offset: 20,
});
```

## Performance Characteristics

**Time Complexity:**

- `store`: O(1) - Map insertion + index updates
- `recall`: O(n) where n = matching records (indexed lookups)
- `forget`: O(m) where m = records to delete
- `get`: O(1) - Direct Map lookup
- `exists`: O(1) - Map.has() check
- `count`: O(n) where n = matching records

**Space Complexity:**

- Main storage: O(n) where n = total records
- Indexes: O(n \* 3) = O(n) - Three indexes

**Optimization Tips:**

- Use specific filters (user_id, session_id) to leverage indexes
- Avoid large `limit` values for pagination
- Run `clearExpired()` regularly to prevent memory bloat

## Future Storage Implementations

The `MemoryStore` interface supports multiple backends:

1. **PostgreSQL** (Phase 3):

   ```typescript
   class PostgresStore implements MemoryStore {
     // Use pg library with connection pool
     // SQL indexes on user_id, session_id, created_at
   }
   ```

2. **DynamoDB** (Phase 3):

   ```typescript
   class DynamoDBStore implements MemoryStore {
     // Use AWS SDK v3
     // Partition key: user_id
     // Sort key: created_at
     // GSI: consent_family, session_id
   }
   ```

3. **Redis** (Phase 3):
   ```typescript
   class RedisStore implements MemoryStore {
     // Use ioredis
     // Hash per user_id
     // Sorted sets for time-range queries
   }
   ```

## Testing

Example test suite:

```typescript
import { InMemoryStore } from './in-memory-store';

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  afterEach(async () => {
    await store.clear();
  });

  it('should store and recall records', async () => {
    const record = createTestRecord();
    await store.store(record);

    const results = await store.recall({
      user_id: record.user_id,
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(record.id);
  });

  it('should enforce TTL expiration', async () => {
    const expired = createTestRecord({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await store.store(expired);

    const deleted = await store.clearExpired();
    expect(deleted).toBe(1);

    const results = await store.recall({
      user_id: expired.user_id,
    });
    expect(results).toHaveLength(0);
  });
});
```

## Migration Path

When migrating from in-memory to persistent storage:

1. Implement new storage adapter (e.g., `PostgresStore`)
2. Run both stores in parallel with write-through
3. Backfill persistent store from in-memory
4. Switch reads to persistent store
5. Deprecate in-memory store

```typescript
// Migration pattern
class HybridStore implements MemoryStore {
  constructor(
    private primary: InMemoryStore,
    private secondary: PostgresStore
  ) {}

  async store(record: MemoryRecord): Promise<MemoryRecord> {
    // Write to both
    await Promise.all([this.primary.store(record), this.secondary.store(record)]);
    return record;
  }

  async recall(query: RecallQuery): Promise<MemoryRecord[]> {
    // Read from primary, fallback to secondary
    const results = await this.primary.recall(query);
    if (results.length > 0) return results;
    return this.secondary.recall(query);
  }
}
```
