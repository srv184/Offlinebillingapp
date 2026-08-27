import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Article } from '@/types';
import { formatCurrency, formatSizeRange } from '@/utils/formatting';

export function ArticleListItem({ article, onPress }: { article: Article; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.name}>{article.name}</Text>
        <Text style={styles.meta}>Size: {formatSizeRange(article.sizes)}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{formatCurrency(article.price)}</Text>
        <Text style={[styles.qty, article.quantity === 0 ? styles.qtyZero : undefined]}>
          Qty: {article.quantity}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e2e2',
    backgroundColor: '#fff',
  },
  left: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  meta: { fontSize: 12, color: '#888', marginTop: 3 },
  right: { alignItems: 'flex-end' },
  price: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  qty: { fontSize: 12, color: '#4a7c59', marginTop: 3 },
  qtyZero: { color: '#c0392b' },
});
