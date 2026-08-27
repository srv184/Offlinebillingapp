import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { dualDatabaseManager } from '@/database/DualDatabaseManager';

interface ArticleExportRow {
  'Article ID': string;
  'Article Name': string;
  Price: number;
  'Available Quantity': number;
  'Created Date': string;
  'Updated Date': string;
}

interface SizeExportRow {
  'Size ID': string;
  'Article ID': string;
  'Article Name': string;
  Size: string;
}

interface BillExportRow {
  'Bill ID': string;
  'Bill Number': string;
  'Customer Name': string;
  Date: string;
  Time: string;
  'Total Quantity': number;
  'Total Amount': number;
}

interface BillItemExportRow {
  'Bill Item ID': string;
  'Bill ID': string;
  'Article ID': string;
  'Article Name': string;
  Size: string;
  Quantity: number;
  'Unit Price': number;
  'Total Price': number;
}

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

export const ExcelExportService = {
  /** Builds the workbook, writes it to a file, and opens the native share sheet. */
  async exportAndShare(): Promise<string> {
    const articles = await dualDatabaseManager.readAll<{
      id: string;
      name: string;
      price: number;
      quantity: number;
      created_at: string;
      updated_at: string;
    }>(`SELECT id, name, price, quantity, created_at, updated_at FROM articles WHERE is_deleted = 0 ORDER BY name COLLATE NOCASE;`);

    const sizes = await dualDatabaseManager.readAll<{
      id: string;
      article_id: string;
      name: string;
      size: string;
    }>(`SELECT article_sizes.id as id, article_sizes.article_id as article_id, articles.name as name, article_sizes.size as size
        FROM article_sizes JOIN articles ON articles.id = article_sizes.article_id
        ORDER BY articles.name COLLATE NOCASE, article_sizes.size;`);

    const bills = await dualDatabaseManager.readAll<{
      id: string;
      bill_number: string;
      customer_name: string;
      created_at: string;
      total_quantity: number;
      total_amount: number;
    }>(`SELECT id, bill_number, customer_name, created_at, total_quantity, total_amount FROM bills WHERE status = 'finalized' ORDER BY created_at;`);

    const billItems = await dualDatabaseManager.readAll<{
      id: string;
      bill_id: string;
      article_id: string;
      article_name_snapshot: string;
      size: string | null;
      quantity: number;
      unit_price: number;
      total_price: number;
    }>(`SELECT bi.id, bi.bill_id, bi.article_id, bi.article_name_snapshot, bi.size, bi.quantity, bi.unit_price, bi.total_price
        FROM bill_items bi JOIN bills b ON b.id = bi.bill_id
        WHERE b.status = 'finalized' ORDER BY bi.bill_id;`);

    const articleRows: ArticleExportRow[] = articles.map((a) => ({
      'Article ID': a.id,
      'Article Name': a.name,
      Price: a.price,
      'Available Quantity': a.quantity,
      'Created Date': a.created_at,
      'Updated Date': a.updated_at,
    }));

    const sizeRows: SizeExportRow[] = sizes.map((s) => ({
      'Size ID': s.id,
      'Article ID': s.article_id,
      'Article Name': s.name,
      Size: s.size,
    }));

    const billRows: BillExportRow[] = bills.map((b) => {
      const { date, time } = splitDateTime(b.created_at);
      return {
        'Bill ID': b.id,
        'Bill Number': b.bill_number,
        'Customer Name': b.customer_name,
        Date: date,
        Time: time,
        'Total Quantity': b.total_quantity,
        'Total Amount': b.total_amount,
      };
    });

    const billItemRows: BillItemExportRow[] = billItems.map((bi) => ({
      'Bill Item ID': bi.id,
      'Bill ID': bi.bill_id,
      'Article ID': bi.article_id,
      'Article Name': bi.article_name_snapshot,
      Size: bi.size ?? '-',
      Quantity: bi.quantity,
      'Unit Price': bi.unit_price,
      'Total Price': bi.total_price,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(articleRows), 'Articles');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sizeRows), 'Article Sizes');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(billRows), 'Bills');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(billItemRows), 'Bill Items');

    const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filename = `billing-export-${Date.now()}.xlsx`;
    const path = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Excel Workbook',
      });
    }

    return path;
  },
};
