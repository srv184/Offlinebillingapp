import { BILL_NUMBER_PAD_LENGTH, BILL_NUMBER_PREFIX } from '@/constants';

export function formatCurrency(amount: number): string {
  return `\u20B9${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBillNumber(n: number): string {
  return `${BILL_NUMBER_PREFIX}${String(n).padStart(BILL_NUMBER_PAD_LENGTH, '0')}`;
}

export function formatDateLocal(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatTimeLocal(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatSizeRange(sizes: string[]): string {
  if (sizes.length === 0) return '-';
  if (sizes.length === 1) return sizes[0];
  return `${sizes[0]} to ${sizes[sizes.length - 1]}`;
}
