// Core domain types shared across the entire application.
// UI code should only ever depend on these types + repository/service
// return values -- it must never construct SQL directly (see README architecture rules).

export interface Article {
  id: string;
  name: string;
  price: number;
  quantity: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  isDeleted: boolean;
  sizes: string[]; // convenience: hydrated from article_sizes
}

export interface ArticleSizeRow {
  id: string;
  articleId: string;
  size: string;
  createdAt: string;
}

export type BillStatus = 'draft' | 'finalized';

export interface Bill {
  id: string;
  billNumber: string;
  customerName: string;
  createdAt: string; // local device timestamp, ISO
  totalQuantity: number;
  totalAmount: number;
  status: BillStatus;
  items: BillItem[];
}

export interface BillItem {
  id: string;
  billId: string;
  articleId: string;
  articleNameSnapshot: string;
  size: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// A cart item is the in-progress, unsaved version of a BillItem while the
// user is building a bill. It carries a locally generated draftItemId so
// it can be edited/removed before anything touches SQLite.
export interface CartItem {
  draftItemId: string;
  articleId: string;
  articleName: string;
  size: string | null;
  quantity: number;
  unitPrice: number; // snapshot taken at add-to-cart time, refreshed on finalize
}

export interface DraftBill {
  draftId: string;
  customerName: string;
  items: CartItem[];
  updatedAt: string;
}

export interface AppSettingsMap {
  inactivityTimeoutMinutes: number;
  businessName: string;
  lastAuthenticatedAt: string | null;
}

export type ActiveDatabase = 'primary' | 'secondary';

export interface DatabaseHealth {
  ok: boolean;
  reason?: string;
}

export interface DatabaseStatusReport {
  primary: DatabaseHealth;
  secondary: DatabaseHealth;
  active: ActiveDatabase;
  lastSynchronizedAt: string | null;
  synchronized: boolean;
  schemaVersion: number;
  recoveryModeActive: boolean;
}

export interface SqlStatement {
  sql: string;
  params?: (string | number | null)[];
}

export type SyncStatus =
  | 'pending'
  | 'primary_ok'
  | 'both_ok'
  | 'secondary_pending'
  | 'failed';

export interface JournalEntry {
  opId: string;
  description: string;
  statements: SqlStatement[];
  status: SyncStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
}

export interface WriteOperation {
  id: string;
  description: string;
  statements: SqlStatement[];
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}
