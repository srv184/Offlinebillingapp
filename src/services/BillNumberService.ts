import { BillRepository } from '@/repositories/BillRepository';
import { formatBillNumber } from '@/utils/formatting';

/**
 * Pure formatting is separated out from the stateful "peek next number"
 * database call so that formatBillNumberFromCount() can be unit tested
 * without any database/native dependency (see __tests__/billNumber.test.ts).
 */
export const BillNumberService = {
  formatBillNumberFromCount(n: number): string {
    return formatBillNumber(n);
  },

  async peekNext(): Promise<string> {
    return BillRepository.peekNextBillNumber();
  },
};
