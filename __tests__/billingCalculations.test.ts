import { BillingService } from '@/services/BillingService';
import { CartItem } from '@/types';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    draftItemId: overrides.draftItemId ?? 'item-1',
    articleId: overrides.articleId ?? 'article-1',
    articleName: overrides.articleName ?? 'Zoya',
    size: overrides.size ?? '6 to 8',
    quantity: overrides.quantity ?? 5,
    unitPrice: overrides.unitPrice ?? 200,
  };
}

describe('BillingService.calculateItemTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(BillingService.calculateItemTotal({ quantity: 5, unitPrice: 200 })).toBe(1000);
  });

  it('rounds to 2 decimal places', () => {
    const result = BillingService.calculateItemTotal({ quantity: 3, unitPrice: 33.333 });
    expect(result).toBeCloseTo(99.999, 1);
  });

  it('handles zero quantity', () => {
    expect(BillingService.calculateItemTotal({ quantity: 0, unitPrice: 200 })).toBe(0);
  });
});

describe('BillingService.calculateBillTotals', () => {
  it('sums quantity and amount across multiple items', () => {
    const items = [
      makeItem({ draftItemId: '1', quantity: 5, unitPrice: 200 }), // 1000
      makeItem({ draftItemId: '2', quantity: 3, unitPrice: 150, articleName: 'Maya' }), // 450
      makeItem({ draftItemId: '3', quantity: 2, unitPrice: 100, articleName: 'Sara' }), // 200
    ];
    const totals = BillingService.calculateBillTotals(items);
    expect(totals.totalQuantity).toBe(10);
    expect(totals.totalAmount).toBe(1650);
  });

  it('returns zero totals for an empty cart', () => {
    const totals = BillingService.calculateBillTotals([]);
    expect(totals.totalQuantity).toBe(0);
    expect(totals.totalAmount).toBe(0);
  });
});

describe('BillingService.quantityAlreadyInCartForArticle', () => {
  it('sums quantities of the same article across multiple cart lines', () => {
    const items = [
      makeItem({ draftItemId: '1', articleId: 'a1', quantity: 3, size: '6' }),
      makeItem({ draftItemId: '2', articleId: 'a1', quantity: 4, size: '8' }),
      makeItem({ draftItemId: '3', articleId: 'a2', quantity: 10, size: '6' }),
    ];
    expect(BillingService.quantityAlreadyInCartForArticle(items, 'a1')).toBe(7);
  });

  it('excludes a specific draft item id (for edit-in-place scenarios)', () => {
    const items = [
      makeItem({ draftItemId: '1', articleId: 'a1', quantity: 3 }),
      makeItem({ draftItemId: '2', articleId: 'a1', quantity: 4 }),
    ];
    expect(BillingService.quantityAlreadyInCartForArticle(items, 'a1', '2')).toBe(3);
  });
});

describe('BillingService.validateBeforeGenerate', () => {
  it('rejects a missing customer name', () => {
    const result = BillingService.validateBeforeGenerate('', [makeItem()]);
    expect(result.valid).toBe(false);
  });

  it('rejects an empty cart', () => {
    const result = BillingService.validateBeforeGenerate('Rahul Sharma', []);
    expect(result.valid).toBe(false);
  });

  it('accepts a valid customer name and non-empty cart', () => {
    const result = BillingService.validateBeforeGenerate('Rahul Sharma', [makeItem()]);
    expect(result.valid).toBe(true);
  });

  it('rejects a zero-quantity line item', () => {
    const result = BillingService.validateBeforeGenerate('Rahul Sharma', [makeItem({ quantity: 0 })]);
    expect(result.valid).toBe(false);
  });
});
