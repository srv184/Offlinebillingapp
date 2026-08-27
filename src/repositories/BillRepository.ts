import { dualDatabaseManager } from '@/database/DualDatabaseManager';
import { Bill, BillItem, CartItem } from '@/types';
import { generateId } from '@/utils/id';
import { formatBillNumber } from '@/utils/formatting';

interface BillRow {
  id: string;
  bill_number: string;
  customer_name: string;
  created_at: string;
  total_quantity: number;
  total_amount: number;
  status: string;
  draft_id: string | null;
}

interface BillItemRow {
  id: string;
  bill_id: string;
  article_id: string;
  article_name_snapshot: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

function hydrateBill(billRow: BillRow, itemRows: BillItemRow[]): Bill {
  return {
    id: billRow.id,
    billNumber: billRow.bill_number,
    customerName: billRow.customer_name,
    createdAt: billRow.created_at,
    totalQuantity: billRow.total_quantity,
    totalAmount: billRow.total_amount,
    status: billRow.status as Bill['status'],
    items: itemRows.map((r) => ({
      id: r.id,
      billId: r.bill_id,
      articleId: r.article_id,
      articleNameSnapshot: r.article_name_snapshot,
      size: r.size,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
    })),
  };
}

export class InsufficientStockError extends Error {
  constructor(public articleName: string, public available: number, public requested: number) {
    super(`Only ${available} of ${articleName} in stock -- cannot bill ${requested}.`);
  }
}

export const BillRepository = {
  /** Peek the bill number that WOULD be assigned if finalized right now, without consuming it. */
  async peekNextBillNumber(): Promise<string> {
    const row = await dualDatabaseManager.readFirst<{ next_number: number }>(
      `SELECT next_number FROM bill_counter WHERE id = 1;`
    );
    return formatBillNumber(row?.next_number ?? 1);
  },

  /**
   * Returns an already-finalized bill for this draft if one exists. This is
   * the core idempotency check: if the app was killed mid-finalize and the
   * transaction had already committed, or if the user double-tapped
   * Save/Print, we detect the existing bill instead of creating another.
   */
  async findFinalizedBillForDraft(draftId: string): Promise<Bill | null> {
    const billRow = await dualDatabaseManager.readFirst<BillRow>(
      `SELECT * FROM bills WHERE draft_id = ? AND status = 'finalized';`,
      [draftId]
    );
    if (!billRow) return null;
    const itemRows = await dualDatabaseManager.readAll<BillItemRow>(
      `SELECT * FROM bill_items WHERE bill_id = ?;`,
      [billRow.id]
    );
    return hydrateBill(billRow, itemRows);
  },

  /**
   * Finalizes a bill: allocates the next bill number, snapshots current
   * article names/prices, deducts inventory, and commits everything as one
   * atomic dual-database operation. Throws InsufficientStockError if any
   * item's requested quantity now exceeds live stock (re-checked here with
   * fresh data, not just whatever the UI last saw).
   *
   * Concurrency note: this app has exactly one active user on one device,
   * and the UI layer (BillingService) guarantees only one finalize call is
   * in flight at a time by disabling Save/Print while a finalize is
   * running and by checking findFinalizedBillForDraft first. Because of
   * that single-writer guarantee, reading bill_counter.next_number here
   * and using it inside the operation statements below is safe without a
   * distributed compare-and-swap.
   */
  async finalize(draftId: string, customerName: string, items: CartItem[]): Promise<Bill> {
    if (items.length === 0) {
      throw new Error('Cannot finalize a bill with no items.');
    }

    const articleIds = [...new Set(items.map((i) => i.articleId))];
    const placeholders = articleIds.map(() => '?').join(',');
    const freshArticles = await dualDatabaseManager.readAll<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>(`SELECT id, name, price, quantity FROM articles WHERE id IN (${placeholders});`, articleIds);
    const articleMap = new Map(freshArticles.map((a) => [a.id, a]));

    // Aggregate requested quantity per article (an article may appear as
    // multiple cart lines with different sizes) and check against live stock.
    const requestedByArticle = new Map<string, number>();
    for (const item of items) {
      requestedByArticle.set(
        item.articleId,
        (requestedByArticle.get(item.articleId) ?? 0) + item.quantity
      );
    }
    for (const [articleId, requestedQty] of requestedByArticle) {
      const article = articleMap.get(articleId);
      if (!article || article.quantity < requestedQty) {
        throw new InsufficientStockError(
          article?.name ?? 'Unknown article',
          article?.quantity ?? 0,
          requestedQty
        );
      }
    }

    const counterRow = await dualDatabaseManager.readFirst<{ next_number: number }>(
      `SELECT next_number FROM bill_counter WHERE id = 1;`
    );
    const nextNumber = counterRow?.next_number ?? 1;
    const billNumber = formatBillNumber(nextNumber);
    const billId = generateId();
    const now = new Date().toISOString();

    let totalQuantity = 0;
    let totalAmount = 0;
    const itemStatements = items.map((item) => {
      const article = articleMap.get(item.articleId)!;
      const unitPrice = article.price; // snapshot: price at time of sale
      const totalPrice = unitPrice * item.quantity;
      totalQuantity += item.quantity;
      totalAmount += totalPrice;
      return {
        sql: `INSERT INTO bill_items (id, bill_id, article_id, article_name_snapshot, size, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        params: [
          generateId(),
          billId,
          item.articleId,
          article.name,
          item.size,
          item.quantity,
          unitPrice,
          totalPrice,
        ],
      };
    });

    const deductionStatements = [...requestedByArticle.entries()].map(([articleId, qty]) => ({
      sql: `UPDATE articles SET quantity = quantity - ?, updated_at = ? WHERE id = ? AND quantity >= ?;`,
      params: [qty, now, articleId, qty],
    }));

    const statements = [
      {
        sql: `UPDATE bill_counter SET next_number = next_number + 1 WHERE id = 1;`,
        params: [],
      },
      {
        sql: `INSERT INTO bills (id, bill_number, customer_name, created_at, total_quantity, total_amount, status, draft_id) VALUES (?, ?, ?, ?, ?, ?, 'finalized', ?);`,
        params: [billId, billNumber, customerName.trim(), now, totalQuantity, totalAmount, draftId],
      },
      ...itemStatements,
      ...deductionStatements,
    ];

    await dualDatabaseManager.applyOperation({
      id: generateId(),
      description: `Finalize bill ${billNumber} for draft ${draftId}`,
      statements,
    });

    const billItems: BillItem[] = items.map((item, idx) => ({
      id: generateId(),
      billId,
      articleId: item.articleId,
      articleNameSnapshot: articleMap.get(item.articleId)!.name,
      size: item.size,
      quantity: item.quantity,
      unitPrice: articleMap.get(item.articleId)!.price,
      totalPrice: articleMap.get(item.articleId)!.price * item.quantity,
    }));

    return {
      id: billId,
      billNumber,
      customerName: customerName.trim(),
      createdAt: now,
      totalQuantity,
      totalAmount,
      status: 'finalized',
      items: billItems,
    };
  },

  async list(): Promise<Bill[]> {
    const rows = await dualDatabaseManager.readAll<BillRow>(
      `SELECT * FROM bills WHERE status = 'finalized' ORDER BY created_at DESC;`
    );
    return rows.map((r) => hydrateBill(r, []));
  },

  async getById(id: string): Promise<Bill | null> {
    const billRow = await dualDatabaseManager.readFirst<BillRow>(
      `SELECT * FROM bills WHERE id = ?;`,
      [id]
    );
    if (!billRow) return null;
    const itemRows = await dualDatabaseManager.readAll<BillItemRow>(
      `SELECT * FROM bill_items WHERE bill_id = ?;`,
      [id]
    );
    return hydrateBill(billRow, itemRows);
  },
};
