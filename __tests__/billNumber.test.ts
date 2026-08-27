import { BillNumberService } from '@/services/BillNumberService';

describe('BillNumberService.formatBillNumberFromCount', () => {
  it('formats the first bill number with zero-padding', () => {
    expect(BillNumberService.formatBillNumberFromCount(1)).toBe('INV000001');
  });

  it('formats a mid-range bill number', () => {
    expect(BillNumberService.formatBillNumberFromCount(42)).toBe('INV000042');
  });

  it('formats a bill number that fills the padding width', () => {
    expect(BillNumberService.formatBillNumberFromCount(123456)).toBe('INV123456');
  });

  it('does not truncate a bill number wider than the padding width', () => {
    expect(BillNumberService.formatBillNumberFromCount(1234567)).toBe('INV1234567');
  });
});
