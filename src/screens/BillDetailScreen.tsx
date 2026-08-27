import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { BillRepository } from '@/repositories/BillRepository';
import { PrintingService } from '@/services/PrintingService';
import { SettingsRepository } from '@/repositories/SettingsRepository';
import { Bill } from '@/types';
import { formatCurrency, formatDateLocal, formatTimeLocal } from '@/utils/formatting';
import { BillsStackParamList } from '@/navigation/types';

export function BillDetailScreen() {
  const route = useRoute<RouteProp<BillsStackParamList, 'BillDetail'>>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [businessName, setBusinessName] = useState('My Business');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    BillRepository.getById(route.params.billId).then(setBill);
    SettingsRepository.getBusinessName().then(setBusinessName);
  }, [route.params.billId]);

  const handleReprint = async () => {
    if (!bill) return;
    setPrinting(true);
    try {
      await PrintingService.printBill(bill, businessName);
    } catch {
      Alert.alert('Printing Unavailable', 'Could not start the print job on this device.');
    } finally {
      setPrinting(false);
    }
  };

  if (!bill) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.businessName}>{businessName}</Text>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLine}>Bill No: {bill.billNumber}</Text>
          <Text style={styles.metaLine}>Customer: {bill.customerName}</Text>
          <Text style={styles.metaLine}>Date: {formatDateLocal(bill.createdAt)}</Text>
          <Text style={styles.metaLine}>Time: {formatTimeLocal(bill.createdAt)}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Article</Text>
          <Text style={styles.th}>Size</Text>
          <Text style={styles.th}>Qty</Text>
          <Text style={styles.th}>Price</Text>
          <Text style={styles.th}>Amount</Text>
        </View>
        {bill.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.td, { flex: 2 }]}>{item.articleNameSnapshot}</Text>
            <Text style={styles.td}>{item.size ?? '-'}</Text>
            <Text style={styles.td}>{item.quantity}</Text>
            <Text style={styles.td}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={styles.td}>{formatCurrency(item.totalPrice)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total ({bill.totalQuantity} items)</Text>
          <Text style={styles.totalAmount}>{formatCurrency(bill.totalAmount)}</Text>
        </View>

        <Text style={styles.note}>
          Prices shown reflect what was charged at the time of this sale, even if article prices
          have changed since.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleReprint} disabled={printing}>
          <Text style={styles.buttonText}>{printing ? 'Printing...' : 'Print This Bill'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  loading: { textAlign: 'center', marginTop: 40, color: '#888' },
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
  note: { fontSize: 11, color: '#999', marginTop: 14, fontStyle: 'italic' },
  button: {
    marginTop: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
