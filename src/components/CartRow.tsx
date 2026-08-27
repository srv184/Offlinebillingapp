import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CartItem } from '@/types';
import { formatCurrency } from '@/utils/formatting';

interface Props {
  item: CartItem;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
}

/**
 * Alert.prompt is iOS-only, so quantity editing is done with a plain,
 * cross-platform inline TextInput instead -- this keeps Save/Cancel-style
 * quantity edits working identically on Android and iOS.
 */
export function CartRow({ item, onChangeQuantity, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState(String(item.quantity));

  const commit = () => {
    const qty = Number(draftQty);
    if (Number.isInteger(qty) && qty > 0) {
      onChangeQuantity(qty);
    } else {
      setDraftQty(String(item.quantity));
    }
    setEditing(false);
  };

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.article}>{item.articleName}</Text>
        <Text style={styles.meta}>
          {item.size ? `Size: ${item.size} · ` : ''}
          {formatCurrency(item.unitPrice)} each · Total {formatCurrency(item.unitPrice * item.quantity)}
        </Text>
      </View>
      <View style={styles.actions}>
        {editing ? (
          <TextInput
            style={styles.qtyInput}
            value={draftQty}
            onChangeText={setDraftQty}
            keyboardType="number-pad"
            autoFocus
            onBlur={commit}
            onSubmitEditing={commit}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={styles.qtyDisplay}>Qty: {item.quantity} ✎</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onRemove}>
          <Text style={styles.removeLink}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  article: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  meta: { fontSize: 12, color: '#888', marginTop: 3 },
  actions: { alignItems: 'flex-end' },
  qtyDisplay: { color: '#1a1a2e', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  qtyInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
    textAlign: 'center',
    marginBottom: 8,
  },
  removeLink: { color: '#c0392b', fontSize: 12, fontWeight: '600' },
});
