
import Database from 'better-sqlite3';
import { Pool, QueryResult } from 'pg';

export interface DBResult<T = any> {
  rows: T[];
  lastInsertId?: number | string | bigint;
  changes?: number;
}

export interface DBAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<DBResult<T>>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<{ lastInsertId?: number | string | bigint; changes: number }>;
  exec(sql: string): Promise<void>;
  close(): void;
}

export class BetterSqliteAdapter implements DBAdapter {
  private db: Database.Database;

  constructor(filename: string, options?: any) {
    this.db = new Database(filename, options);
    console.log(`[DB] Connected to SQLite: ${filename}`);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<DBResult<T>> {
    const stmt = this.db.prepare(sql);
    // SQLite 'all' returns array of rows
    // To handle INSERT/UPDATE returning data (not supported natively like PG RETURNING in older sqlite?)
    // But basic SELECT uses .all()
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = stmt.all(...params) as T[];
        return { rows };
      } else {
        // For INSERT/UPDATE/DELETE, better-sqlite3 uses .run()
        // But if user calls query(), maybe they expect rows?
        // If query has RETURNING, utilize .all() or .get()
        // better-sqlite3 supports RETURNING clause
        const rows = stmt.all(...params) as T[];
        return { rows };
      }
    } catch (e) {
      // Fallback if .all() fails on a non-returning query? No, .all() works for most.
      // But let's separate semantics. Users should use .run() for mutations without RETURNING.
      // If we use .all() on INSERT without RETURNING, it returns empty array.
      const rows = stmt.all(...params) as T[];
      return { rows };
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastInsertId?: number | string | bigint; changes: number }> {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return {
      lastInsertId: info.lastInsertRowid,
      changes: info.changes
    };
  }

  close() {
    this.db.close();
  }
}

export class PostgresAdapter implements DBAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined
    });
    console.log('[DB] Connected to Postgres pool');
  }

  private convertSql(sql: string): string {
    let i = 1;
    // Replace ? with $1, $2, etc.
    // Handles simple cases. Be careful with '?' inside strings.
    // Assuming our codebase uses ? strictly as placeholders.
    return sql.replace(/\?/g, () => `$${i++}`);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<DBResult<T>> {
    const convertedSql = this.convertSql(sql);
    const result = await this.pool.query(convertedSql, params);
    return {
      rows: result.rows,
      changes: result.rowCount || 0
    };
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const result = await this.query<T>(sql, params);
    return result.rows[0];
  }

  async run(sql: string, params: any[] = []): Promise<{ lastInsertId?: number | string | bigint; changes: number }> {
    // PG doesn't return lastInsertId automatically unless RETURNING id is used.
    // Our code expects `lastInsertRowid` for INSERTs.
    // So we need to append RETURNING id if it's an INSERT and not present?
    // OR we modify the SQL in the Model to include RETURNING id.
    // That is a Model logic change.

    // For now, let's assume we update Models to use RETURNING id or handle it.
    // BUT for compatibility, SQLite supports `lastInsertRowid`.
    // If we use RETURNING id in SQL, does SQLite support it? Yes, recent SQLite does.

    const convertedSql = this.convertSql(sql);

    // Check if it's an INSERT and missing RETURNING
    // This is hacky. Better to fix Models to return needed data or use explicit SELECT.

    const result = await this.pool.query(convertedSql, params);

    // Try to guess insertId from rows if RETURNING was present
    let lastInsertId: string | number | undefined;
    if (result.rows.length > 0 && result.rows[0].id) {
      lastInsertId = result.rows[0].id;
    }

    return {
      lastInsertId, // Might be undefined if no RETURNING
      changes: result.rowCount || 0
    };
  }

  async exec(sql: string): Promise<void> {
    const convertedSql = this.convertSql(sql);
    await this.pool.query(convertedSql);
  }

  close() {
    this.pool.end();
  }
}
