import React, { useCallback, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BillRepository } from '@/repositories/BillRepository';
import { Bill } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { formatCurrency, formatDateLocal, formatTimeLocal } from '@/utils/formatting';
import { BillsStackParamList } from '@/navigation/types';

export function BillHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BillsStackParamList>>();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      BillRepository.list().then((results) => {
        if (!cancelled) {
          setBills(results);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Bill History</Text>
      {!loading && bills.length === 0 ? (
        <EmptyState title="No bills yet" subtitle="Finalized bills will appear here." />
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
            >
              <View>
                <Text style={styles.billNumber}>{item.billNumber}</Text>
                <Text style={styles.customer}>{item.customerName}</Text>
                <Text style={styles.date}>
                  {formatDateLocal(item.createdAt)} · {formatTimeLocal(item.createdAt)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f9' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', padding: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 14,
  },
  billNumber: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  customer: { fontSize: 13, color: '#444', marginTop: 2 },
  date: { fontSize: 11, color: '#888', marginTop: 4 },
  amount: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
});
