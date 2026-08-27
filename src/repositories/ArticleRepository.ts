import { dualDatabaseManager } from '@/database/DualDatabaseManager';
import { Article } from '@/types';
import { generateId } from '@/utils/id';

interface ArticleRow {
  id: string;
  name: string;
  price: number;
  quantity: number;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

interface SizeRow {
  id: string;
  article_id: string;
  size: string;
  created_at: string;
}

function hydrateArticles(rows: ArticleRow[], sizeRows: SizeRow[]): Article[] {
  const sizesByArticle = new Map<string, string[]>();
  for (const s of sizeRows) {
    const list = sizesByArticle.get(s.article_id) ?? [];
    list.push(s.size);
    sizesByArticle.set(s.article_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    quantity: r.quantity,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    isDeleted: !!r.is_deleted,
    sizes: sizesByArticle.get(r.id) ?? [],
  }));
}

export const ArticleRepository = {
  /**
   * Returns all non-deleted articles, optionally filtered by a case
   * insensitive substring match on name, sorted alphabetically.
   */
  async list(searchText = ''): Promise<Article[]> {
    const trimmed = searchText.trim();
    const rows = trimmed
      ? await dualDatabaseManager.readAll<ArticleRow>(
          `SELECT * FROM articles WHERE is_deleted = 0 AND name LIKE ? COLLATE NOCASE ORDER BY name COLLATE NOCASE ASC;`,
          [`%${trimmed}%`]
        )
      : await dualDatabaseManager.readAll<ArticleRow>(
          `SELECT * FROM articles WHERE is_deleted = 0 ORDER BY name COLLATE NOCASE ASC;`
        );
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const sizeRows = await dualDatabaseManager.readAll<SizeRow>(
      `SELECT * FROM article_sizes WHERE article_id IN (${placeholders}) ORDER BY size ASC;`,
      ids
    );
    return hydrateArticles(rows, sizeRows);
  },

  async getById(id: string): Promise<Article | null> {
    const row = await dualDatabaseManager.readFirst<ArticleRow>(
      `SELECT * FROM articles WHERE id = ? AND is_deleted = 0;`,
      [id]
    );
    if (!row) return null;
    const sizeRows = await dualDatabaseManager.readAll<SizeRow>(
      `SELECT * FROM article_sizes WHERE article_id = ? ORDER BY size ASC;`,
      [id]
    );
    return hydrateArticles([row], sizeRows)[0];
  },

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const row = excludeId
      ? await dualDatabaseManager.readFirst<{ id: string }>(
          `SELECT id FROM articles WHERE name = ? COLLATE NOCASE AND is_deleted = 0 AND id != ?;`,
          [name.trim(), excludeId]
        )
      : await dualDatabaseManager.readFirst<{ id: string }>(
          `SELECT id FROM articles WHERE name = ? COLLATE NOCASE AND is_deleted = 0;`,
          [name.trim()]
        );
    return !!row;
  },

  /** Creates a new article with one or more sizes as a single dual-write operation. */
  async create(input: { name: string; price: number; quantity: number; sizes: string[] }): Promise<string> {
    const articleId = generateId();
    const now = new Date().toISOString();
    const statements = [
      {
        sql: `INSERT INTO articles (id, name, price, quantity, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, 0);`,
        params: [articleId, input.name.trim(), input.price, input.quantity, now, now],
      },
      ...input.sizes
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((size) => ({
          sql: `INSERT INTO article_sizes (id, article_id, size, created_at) VALUES (?, ?, ?, ?);`,
          params: [generateId(), articleId, size, now],
        })),
    ];
    await dualDatabaseManager.applyOperation({
      id: generateId(),
      description: `Create article ${input.name}`,
      statements,
    });
    return articleId;
  },

  async update(
    articleId: string,
    input: { name: string; price: number; quantity: number; sizes: string[] }
  ): Promise<void> {
    const now = new Date().toISOString();
    const statements = [
      {
        sql: `UPDATE articles SET name = ?, price = ?, quantity = ?, updated_at = ? WHERE id = ?;`,
        params: [input.name.trim(), input.price, input.quantity, now, articleId],
      },
      { sql: `DELETE FROM article_sizes WHERE article_id = ?;`, params: [articleId] },
      ...input.sizes
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((size) => ({
          sql: `INSERT INTO article_sizes (id, article_id, size, created_at) VALUES (?, ?, ?, ?);`,
          params: [generateId(), articleId, size, now],
        })),
    ];
    await dualDatabaseManager.applyOperation({
      id: generateId(),
      description: `Update article ${articleId}`,
      statements,
    });
  },

  async softDelete(articleId: string): Promise<void> {
    const now = new Date().toISOString();
    await dualDatabaseManager.applyOperation({
      id: generateId(),
      description: `Delete article ${articleId}`,
      statements: [
        {
          sql: `UPDATE articles SET is_deleted = 1, updated_at = ? WHERE id = ?;`,
          params: [now, articleId],
        },
      ],
    });
  },
};
