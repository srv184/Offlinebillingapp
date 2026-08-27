import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBillingCart } from '@/navigation/BillingCartContext';
import { BillingService, BillValidationError } from '@/services/BillingService';
import { BillNumberService } from '@/services/BillNumberService';
import { PrintingService } from '@/services/PrintingService';
import { SettingsRepository } from '@/repositories/SettingsRepository';
import { Bill } from '@/types';
import { formatCurrency, formatDateLocal, formatTimeLocal } from '@/utils/formatting';

/**
 * This screen shows a PREVIEW of the bill (with the bill number the app
 * WOULD assign right now) but does not touch the database until the user
 * taps Save Bill or Print Bill. Editing here just navigates back to the
 * cart -- nothing has been committed yet, matching section 18.
 */
export function GeneratedBillScreen() {
  const navigation = useNavigation();
  const { customerName, items, totals, clearCart } = useBillingCart();
  const [previewBillNumber, setPreviewBillNumber] = useState('...');
  const [businessName, setBusinessName] = useState('My Business');
  const [finalizedBill, setFinalizedBill] = useState<Bill | null>(null);
  const [processing, setProcessing] = useState<'save' | 'print' | null>(null);
  const previewDate = useMemo(() => new Date().toISOString(), []);

  useEffect(() => {
    BillNumberService.peekNext().then(setPreviewBillNumber);
    SettingsRepository.getBusinessName().then(setBusinessName);
  }, []);

  const displayBill = finalizedBill ?? {
    billNumber: previewBillNumber,
    customerName,
    createdAt: previewDate,
    totalQuantity: totals.totalQuantity,
    totalAmount: totals.totalAmount,
    items: items.map((i) => ({
      id: i.draftItemId,
      billId: '',
      articleId: i.articleId,
      articleNameSnapshot: i.articleName,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.unitPrice * i.quantity,
    })),
  };

  const handleEdit = () => {
    navigation.goBack();
  };

  const runFinalize = async (): Promise<Bill | null> => {
    try {
      const bill = await BillingService.finalizeActiveDraft(customerName, items);
      setFinalizedBill(bill);
      await clearCart();
      return bill;
    } catch (err) {
      if (err instanceof BillValidationError) {
        Alert.alert('Cannot Finalize Bill', err.message);
      } else {
        Alert.alert('Error', 'Something went wrong while saving the bill. Please try again.');
      }
      return null;
    }
  };

  const handleSave = async () => {
    if (processing) return;
    setProcessing('save');
    const bill = await runFinalize();
    setProcessing(null);
    if (bill) {
      Alert.alert('Bill Saved', `${bill.billNumber} has been saved and inventory updated.`, [
        { text: 'OK', onPress: () => navigation.navigate('Home' as never) },
      ]);
    }
  };

  const handlePrint = async () => {
    if (processing) return;
    setProcessing('print');
    // Print Bill always saves first (section 20) -- if it's already been
    // finalized (e.g. user already tapped Save, or a previous Print
    // attempt already committed it before the app was killed), this just
    // returns the existing bill instead of creating a second one.
    const bill = await runFinalize();
    if (bill) {
      try {
        await PrintingService.printBill(bill, businessName);
      } catch {
        Alert.alert(
          'Printing Unavailable',
          'The bill was saved, but printing could not be started. You can print it again from Bill History.'
        );
      }
    }
    setProcessing(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.businessName}>{businessName}</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLine}>Bill No: {displayBill.billNumber}</Text>
          <Text style={styles.metaLine}>Customer: {displayBill.customerName}</Text>
          <Text style={styles.metaLine}>Date: {formatDateLocal(displayBill.createdAt)}</Text>
          <Text style={styles.metaLine}>Time: {formatTimeLocal(displayBill.createdAt)}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Article</Text>
          <Text style={styles.th}>Size</Text>
          <Text style={styles.th}>Qty</Text>
          <Text style={styles.th}>Price</Text>
          <Text style={styles.th}>Amount</Text>
        </View>
        {displayBill.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.td, { flex: 2 }]}>{item.articleNameSnapshot}</Text>
            <Text style={styles.td}>{item.size ?? '-'}</Text>
            <Text style={styles.td}>{item.quantity}</Text>
            <Text style={styles.td}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={styles.td}>{formatCurrency(item.totalPrice)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total ({displayBill.totalQuantity} items)</Text>
          <Text style={styles.totalAmount}>{formatCurrency(displayBill.totalAmount)}</Text>
        </View>

        {finalizedBill && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>✓ Saved to Bill History</Text>
          </View>
        )}

        <View style={styles.actions}>
          {!finalizedBill && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleEdit}>
              <Text style={styles.secondaryButtonText}>Back to Cart / Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.button, processing === 'save' && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!!processing}
          >
            <Text style={styles.buttonText}>{processing === 'save' ? 'Saving...' : 'Save Bill'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.printButton, processing === 'print' && styles.buttonDisabled]}
            onPress={handlePrint}
            disabled={!!processing}
          >
            <Text style={styles.buttonText}>{processing === 'print' ? 'Printing...' : 'Print Bill'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20 },
  businessName: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 12 },
  metaBlock: { marginBottom: 16 },
  metaLine: { fontSize: 13, color: '#444', marginBottom: 2 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 6 },
  th: { flex: 1, fontSize: 11, fontWeight: '700', color: '#333' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  td: { flex: 1, fontSize: 12, color: '#1a1a1a' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#1a1a2e',
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  totalAmount: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  savedBadge: { marginTop: 16, backgroundColor: '#e7f6ec', borderRadius: 8, padding: 10, alignItems: 'center' },
  savedBadgeText: { color: '#2e7d4f', fontWeight: '600', fontSize: 13 },
  actions: { marginTop: 24, gap: 10 },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#555', fontWeight: '600' },
  button: { backgroundColor: '#1a1a2e', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  printButton: { backgroundColor: '#3a3a5e' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
