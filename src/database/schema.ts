// Canonical schema. Both the primary and secondary databases are created
// from this exact same set of statements, so they are always structurally
// identical. Never modify tables directly elsewhere -- add a new migration
// step in migrations.ts instead and bump SCHEMA_VERSION.

export const CREATE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS schema_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE INDEX IF NOT EXISTS idx_articles_name ON articles(name COLLATE NOCASE);`,

  `CREATE TABLE IF NOT EXISTS article_sizes (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    size TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES articles(id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_article_sizes_article_id ON article_sizes(article_id);`,

  `CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    bill_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    total_quantity INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL,
    draft_id TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_bills_draft_id ON bills(draft_id);`,

  `CREATE TABLE IF NOT EXISTS bill_items (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    article_name_snapshot TEXT NOT NULL,
    size TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS draft_bills (
    draft_id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS draft_bill_items (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    article_name TEXT NOT NULL,
    size TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY (draft_id) REFERENCES draft_bills(draft_id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_draft_items_draft_id ON draft_bill_items(draft_id);`,

  // Guards exactly-once application of a WriteOperation to THIS database.
  // See DualDatabaseManager for how this makes journal replay idempotent.
  `CREATE TABLE IF NOT EXISTS applied_operations (
    id TEXT PRIMARY KEY,
    description TEXT,
    applied_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS bill_counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    next_number INTEGER NOT NULL
  );`,
];

export const SEED_STATEMENTS: SeedStatement[] = [
  { sql: `INSERT OR IGNORE INTO bill_counter (id, next_number) VALUES (1, 1);`, params: [] },
];

interface SeedStatement {
  sql: string;
  params: (string | number | null)[];
}
