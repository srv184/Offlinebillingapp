import * as Print from 'expo-print';
import { Bill } from '@/types';
import { formatCurrency, formatDateLocal, formatTimeLocal } from '@/utils/formatting';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildInvoiceHtml(bill: Bill, businessName: string): string {
  const rows = bill.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.articleNameSnapshot)}</td>
        <td>${escapeHtml(item.size ?? '-')}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatCurrency(item.unitPrice)}</td>
        <td class="num">${formatCurrency(item.totalPrice)}</td>
      </tr>`
    )
    .join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 20px; margin-bottom: 0; }
        .meta { margin: 12px 0; font-size: 13px; color: #444; }
        .meta div { margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; font-size: 13px; text-align: left; }
        th { background: #f3f3f3; }
        .num { text-align: right; }
        .total-row td { font-weight: bold; border-top: 2px solid #333; border-bottom: none; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(businessName)}</h1>
      <div class="meta">
        <div><strong>Bill No:</strong> ${escapeHtml(bill.billNumber)}</div>
        <div><strong>Customer:</strong> ${escapeHtml(bill.customerName)}</div>
        <div><strong>Date:</strong> ${formatDateLocal(bill.createdAt)}</div>
        <div><strong>Time:</strong> ${formatTimeLocal(bill.createdAt)}</div>
      </div>
      <table>
        <thead>
          <tr><th>Article</th><th>Size</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2">Total</td>
            <td class="num">${bill.totalQuantity}</td>
            <td></td>
            <td class="num">${formatCurrency(bill.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>`;
}

export const PrintingService = {
  /**
   * Opens the OS print flow (AirPrint on iOS, the Android print service /
   * OS printer picker on Android). This works fully offline for any
   * printer the device's OS already supports locally (Wi-Fi Direct/AirPrint
   * printers, PDF-to-file, etc.) -- Claude/Expo have no involvement in
   * discovering printers, that's entirely handled by the OS print service.
   */
  async printBill(bill: Bill, businessName: string): Promise<void> {
    const html = buildInvoiceHtml(bill, businessName);
    await Print.printAsync({ html });
  },
};
