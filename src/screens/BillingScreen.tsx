import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBillingCart } from '@/navigation/BillingCartContext';
import { ArticleRepository } from '@/repositories/ArticleRepository';
import { Article, CartItem } from '@/types';
import { InventoryService } from '@/services/InventoryService';
import { BillingService } from '@/services/BillingService';
import { formatCurrency } from '@/utils/formatting';
import { BillingStackParamList } from '@/navigation/types';
import { CartRow } from '@/components/CartRow';

export function BillingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BillingStackParamList>>();
  const { customerName, setCustomerName, items, addItem, updateItem, removeItem, totals } =
    useBillingCart();

  const [addingItem, setAddingItem] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);

  const runSearch = useCallback(async (text: string) => {
    const results = await ArticleRepository.list(text);
    setSearchResults(results);
  }, []);

  useEffect(() => {
    if (addingItem) runSearch(search);
  }, [addingItem, search, runSearch]);

  const openAddItem = () => {
    setAddingItem(true);
    setSelectedArticle(null);
    setSelectedSize(null);
    setQtyText('');
    setItemError(null);
    setSearch('');
  };

  const selectArticle = (article: Article) => {
    setSelectedArticle(article);
    setSelectedSize(article.sizes.length === 1 ? article.sizes[0] : null);
    setItemError(null);
  };

  const confirmAddItem = async () => {
    if (!selectedArticle) {
      setItemError('Select an article first.');
      return;
    }
    if (selectedArticle.sizes.length > 0 && !selectedSize) {
      setItemError('Select a size.');
      return;
    }
    const qty = Number(qtyText);
    if (!Number.isInteger(qty) || qty <= 0) {
      setItemError('Enter a quantity greater than zero.');
      return;
    }
    const alreadyInCart = BillingService.quantityAlreadyInCartForArticle(items, selectedArticle.id);
    const check = await InventoryService.validateQuantity(selectedArticle.id, qty, alreadyInCart);
    if (!check.valid) {
      setItemError(check.message ?? 'Invalid quantity.');
      return;
    }
    const newItem: Omit<CartItem, 'draftItemId'> = {
      articleId: selectedArticle.id,
      articleName: selectedArticle.name,
      size: selectedSize,
      quantity: qty,
      unitPrice: selectedArticle.price,
    };
    addItem(newItem);
    setAddingItem(false);
  };

  const handleGenerateBill = () => {
    const validation = BillingService.validateBeforeGenerate(customerName, items);
    if (!validation.valid) {
      Alert.alert('Cannot Generate Bill', validation.message);
      return;
    }
    navigation.navigate('GeneratedBill');
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <CartRow
      item={item}
      onChangeQuantity={async (qty) => {
        const alreadyInCart = BillingService.quantityAlreadyInCartForArticle(
          items,
          item.articleId,
          item.draftItemId
        );
        const check = await InventoryService.validateQuantity(item.articleId, qty, alreadyInCart);
        if (!check.valid) {
          Alert.alert('Invalid Quantity', check.message);
          return;
        }
        updateItem(item.draftItemId, { quantity: qty });
      }}
      onRemove={() => removeItem(item.draftItemId)}
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.draftItemId}
          renderItem={renderCartItem}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Text style={styles.title}>Billing</Text>
              <Text style={styles.label}>Customer Name</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="e.g. Rahul Sharma"
              />

              {!addingItem ? (
                <TouchableOpacity style={styles.addItemButton} onPress={openAddItem}>
                  <Text style={styles.addItemButtonText}>+ Add Item</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.addItemPanel}>
                  {!selectedArticle ? (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Search articles..."
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                        autoFocus
                      />
                      {searchResults.map((a) => (
                        <TouchableOpacity key={a.id} style={styles.searchRow} onPress={() => selectArticle(a)}>
                          <Text style={styles.searchRowText}>{a.name}</Text>
                          <Text style={styles.searchRowMeta}>
                            {formatCurrency(a.price)} · Qty {a.quantity}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {searchResults.length === 0 && (
                        <Text style={styles.noResults}>No matching articles.</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.selectedName}>{selectedArticle.name}</Text>
                      {selectedArticle.sizes.length > 0 && (
                        <>
                          <Text style={styles.label}>Size</Text>
                          <View style={styles.sizeChips}>
                            {selectedArticle.sizes.map((s) => (
                              <TouchableOpacity
                                key={s}
                                style={[styles.chip, selectedSize === s && styles.chipSelected]}
                                onPress={() => setSelectedSize(s)}
                              >
                                <Text style={[styles.chipText, selectedSize === s && styles.chipTextSelected]}>
                                  {s}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                      <Text style={styles.label}>Quantity (available: {selectedArticle.quantity})</Text>
                      <TextInput
                        style={styles.input}
                        value={qtyText}
                        onChangeText={setQtyText}
                        keyboardType="number-pad"
                        placeholder="e.g. 5"
                      />
                      {itemError && <Text style={styles.error}>{itemError}</Text>}
                      <View style={styles.itemActionsRow}>
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedArticle(null)}>
                          <Text style={styles.secondaryButtonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryButtonSmall} onPress={confirmAddItem}>
                          <Text style={styles.primaryButtonSmallText}>Add to Bill</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                  <TouchableOpacity onPress={() => setAddingItem(false)}>
                    <Text style={styles.cancelLink}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {items.length > 0 && <Text style={styles.cartHeading}>Items ({items.length})</Text>}
            </View>
          }
          ListEmptyComponent={
            !addingItem ? <Text style={styles.emptyCart}>No items added yet.</Text> : null
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total Qty: {totals.totalQuantity}</Text>
                <Text style={styles.totalsAmount}>{formatCurrency(totals.totalAmount)}</Text>
              </View>
              <TouchableOpacity style={styles.generateButton} onPress={handleGenerateBill}>
                <Text style={styles.generateButtonText}>Generate Bill</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f9' },
  headerBlock: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  addItemButton: {
    marginTop: 16,
    backgroundColor: '#eef0ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addItemButtonText: { color: '#1a1a2e', fontWeight: '600' },
  addItemPanel: { marginTop: 14, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  searchRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchRowText: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  searchRowMeta: { fontSize: 12, color: '#888' },
  noResults: { fontSize: 13, color: '#888', paddingVertical: 10, textAlign: 'center' },
  selectedName: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  sizeChips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginTop: 6,
  },
  chipSelected: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextSelected: { color: '#fff' },
  error: { color: '#c0392b', fontSize: 13, marginTop: 8 },
  itemActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 16 },
  secondaryButtonText: { color: '#555', fontWeight: '600' },
  primaryButtonSmall: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  primaryButtonSmallText: { color: '#fff', fontWeight: '600' },
  cancelLink: { textAlign: 'center', color: '#888', marginTop: 12, fontSize: 12 },
  cartHeading: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 18 },
  cartRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  cartArticle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  cartMeta: { fontSize: 12, color: '#888', marginTop: 3 },
  cartActions: { alignItems: 'flex-end' },
  editLink: { color: '#1a1a2e', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  removeLink: { color: '#c0392b', fontSize: 12, fontWeight: '600' },
  emptyCart: { textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13 },
  footer: { paddingHorizontal: 16, marginTop: 10 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalsLabel: { fontSize: 14, color: '#444' },
  totalsAmount: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  generateButton: { backgroundColor: '#1a1a2e', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
