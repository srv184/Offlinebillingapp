import { CartItem, Bill } from '@/types';
import { BillRepository, InsufficientStockError } from '@/repositories/BillRepository';
import { DraftRepository } from '@/repositories/DraftRepository';
import { validateCustomerName } from '@/utils/validation';

export class BillValidationError extends Error {}

// Module-level in-flight guard: even though the UI disables the Save/Print
// button while finalizing, this is a second line of defense against a
// rapid double-tap firing two handler invocations before React re-renders
// the disabled state (see section 48: Print/Save idempotency).
let inFlightFinalize: Promise<Bill> | null = null;

export const BillingService = {
  calculateItemTotal(item: Pick<CartItem, 'quantity' | 'unitPrice'>): number {
    return round2(item.quantity * item.unitPrice);
  },

  calculateBillTotals(items: CartItem[]): { totalQuantity: number; totalAmount: number } {
    let totalQuantity = 0;
    let totalAmount = 0;
    for (const item of items) {
      totalQuantity += item.quantity;
      totalAmount += this.calculateItemTotal(item);
    }
    return { totalQuantity, totalAmount: round2(totalAmount) };
  },

  quantityAlreadyInCartForArticle(items: CartItem[], articleId: string, excludingDraftItemId?: string): number {
    return items
      .filter((i) => i.articleId === articleId && i.draftItemId !== excludingDraftItemId)
      .reduce((sum, i) => sum + i.quantity, 0);
  },

  validateBeforeGenerate(customerName: string, items: CartItem[]): { valid: boolean; message?: string } {
    const nameCheck = validateCustomerName(customerName);
    if (!nameCheck.valid) return nameCheck;
    if (items.length === 0) {
      return { valid: false, message: 'Add at least one item before generating the bill.' };
    }
    for (const item of items) {
      if (item.quantity <= 0) {
        return { valid: false, message: `${item.articleName}: quantity must be greater than zero.` };
      }
    }
    return { valid: true };
  },

  /**
   * Finalizes the active draft into a permanent bill. Safe to call
   * repeatedly (double taps, or a retry after the app was killed
   * mid-transaction): it first checks whether this draft already produced
   * a finalized bill and returns that instead of creating a duplicate.
   */
  async finalizeActiveDraft(customerName: string, items: CartItem[]): Promise<Bill> {
    if (inFlightFinalize) {
      return inFlightFinalize;
    }

    const validation = this.validateBeforeGenerate(customerName, items);
    if (!validation.valid) {
      throw new BillValidationError(validation.message);
    }

    const draftId = DraftRepository.getActiveDraftId();

    const run = async (): Promise<Bill> => {
      const existing = await BillRepository.findFinalizedBillForDraft(draftId);
      if (existing) {
        await DraftRepository.clearActiveDraft();
        return existing;
      }
      try {
        const bill = await BillRepository.finalize(draftId, customerName, items);
        await DraftRepository.clearActiveDraft();
        return bill;
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          throw new BillValidationError(err.message);
        }
        throw err;
      }
    };

    inFlightFinalize = run();
    try {
      return await inFlightFinalize;
    } finally {
      inFlightFinalize = null;
    }
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
