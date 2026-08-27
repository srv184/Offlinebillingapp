import { dualDatabaseManager } from '@/database/DualDatabaseManager';
import { CartItem, DraftBill } from '@/types';
import { generateId } from '@/utils/id';

interface DraftBillRow {
  draft_id: string;
  customer_name: string;
  status: string;
  updated_at: string;
}

interface DraftItemRow {
  id: string;
  draft_id: string;
  article_id: string;
  article_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
}

/**
 * There is exactly one "open" active draft at a time in this app (single
 * billing workflow), identified by a well-known singleton ID. This is what
 * lets the Billing screen survive navigation away/back and even a full
 * app kill without losing the customer name, items, quantities or sizes
 * the user had entered (section 39 / edge case: "Application killed
 * during billing").
 */
const ACTIVE_DRAFT_ID = 'active-draft-singleton';

function rowsToDraft(billRow: DraftBillRow, itemRows: DraftItemRow[]): DraftBill {
  return {
    draftId: billRow.draft_id,
    customerName: billRow.customer_name,
    updatedAt: billRow.updated_at,
    items: itemRows.map((r) => ({
      draftItemId: r.id,
      articleId: r.article_id,
      articleName: r.article_name,
      size: r.size,
      quantity: r.quantity,
      unitPrice: r.unit_price,
    })),
  };
}

export const DraftRepository = {
  async getActiveDraft(): Promise<DraftBill | null> {
    const billRow = await dualDatabaseManager.readFirst<DraftBillRow>(
      `SELECT * FROM draft_bills WHERE draft_id = ? AND status = 'open';`,
      [ACTIVE_DRAFT_ID]
    );
    if (!billRow) return null;
    const itemRows = await dualDatabaseManager.readAll<DraftItemRow>(
      `SELECT * FROM draft_bill_items WHERE draft_id = ?;`,
      [ACTIVE_DRAFT_ID]
    );
    return rowsToDraft(billRow, itemRows);
  },

  getActiveDraftId(): string {
    return ACTIVE_DRAFT_ID;
  },

  /** Upserts customer name + full item list for the singleton active draft. */
  async saveActiveDraft(customerName: string, items: CartItem[]): Promise<void> {
    const now = new Date().toISOString();
    const statements = [
      {
        sql: `INSERT INTO draft_bills (draft_id, customer_name, status, updated_at) VALUES (?, ?, 'open', ?)
              ON CONFLICT(draft_id) DO UPDATE SET customer_name = excluded.customer_name, updated_at = excluded.updated_at, status = 'open';`,
        params: [ACTIVE_DRAFT_ID, customerName, now],
      },
      { sql: `DELETE FROM draft_bill_items WHERE draft_id = ?;`, params: [ACTIVE_DRAFT_ID] },
      ...items.map((item) => ({
        sql: `INSERT INTO draft_bill_items (id, draft_id, article_id, article_name, size, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        params: [
          item.draftItemId,
          ACTIVE_DRAFT_ID,
          item.articleId,
          item.articleName,
          item.size,
          item.quantity,
          item.unitPrice,
        ],
      })),
    ];
    // Draft persistence is local scratch state, not permanent business
    // history, so we write it straight to the active DB without going
    // through the dual-write/journal machinery -- there is nothing here
    // that must survive a corrupted primary database. It IS still
    // recreated automatically the next time articles/sizes are picked
    // since the user simply re-enters it if truly lost.
    await dualDatabaseManager.activeConnection().execStatements(statements);
  },

  async clearActiveDraft(): Promise<void> {
    await dualDatabaseManager
      .activeConnection()
      .execStatements([
        { sql: `DELETE FROM draft_bill_items WHERE draft_id = ?;`, params: [ACTIVE_DRAFT_ID] },
        { sql: `DELETE FROM draft_bills WHERE draft_id = ?;`, params: [ACTIVE_DRAFT_ID] },
      ]);
  },

  newDraftItemId(): string {
    return generateId();
  },
};
