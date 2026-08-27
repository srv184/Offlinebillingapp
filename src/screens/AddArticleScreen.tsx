import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArticleRepository } from '@/repositories/ArticleRepository';
import {
  validateArticleName,
  validatePrice,
  validateQuantityField,
  validateSizesList,
} from '@/utils/validation';

export function AddArticleScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [sizes, setSizes] = useState<string[]>(['']);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const updateSize = (index: number, value: string) => {
    setSizes((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const addSizeField = () => setSizes((prev) => [...prev, '']);
  const removeSizeField = (index: number) =>
    setSizes((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const resetForm = () => {
    setName('');
    setPrice('');
    setQuantity('');
    setSizes(['']);
    setErrors([]);
  };

  const handleSave = async () => {
    const collected: string[] = [];
    const nameCheck = validateArticleName(name);
    if (!nameCheck.valid) collected.push(nameCheck.message!);
    const priceCheck = validatePrice(price);
    if (!priceCheck.valid) collected.push(priceCheck.message!);
    const qtyCheck = validateQuantityField(quantity);
    if (!qtyCheck.valid) collected.push(qtyCheck.message!);
    const sizesCheck = validateSizesList(sizes);
    if (!sizesCheck.valid) collected.push(sizesCheck.message!);

    if (collected.length > 0) {
      setErrors(collected);
      return;
    }

    setErrors([]);
    setSaving(true);
    try {
      const duplicate = await ArticleRepository.nameExists(name);
      if (duplicate) {
        setErrors([`An article named "${name.trim()}" already exists.`]);
        setSaving(false);
        return;
      }
      await ArticleRepository.create({
        name,
        price: Number(price),
        quantity: Number(quantity),
        sizes,
      });
      Alert.alert('Article Saved', `${name.trim()} is now available in inventory and billing.`, [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            navigation.navigate('Home' as never);
          },
        },
      ]);
    } catch (err) {
      setErrors(['Could not save the article. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add Article</Text>

          <Text style={styles.label}>Article Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Zoya" />

          <Text style={styles.label}>Price</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 200"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 50"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Sizes</Text>
          {sizes.map((size, index) => (
            <View key={index} style={styles.sizeRow}>
              <TextInput
                style={[styles.input, styles.sizeInput]}
                value={size}
                onChangeText={(t) => updateSize(index, t)}
                placeholder="e.g. 6 or Free Size"
              />
              {sizes.length > 1 && (
                <TouchableOpacity onPress={() => removeSizeField(index)} style={styles.removeSizeButton}>
                  <Text style={styles.removeSizeText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addSizeField} style={styles.addSizeButton}>
            <Text style={styles.addSizeText}>+ Add another size</Text>
          </TouchableOpacity>

          {errors.length > 0 && (
            <View style={styles.errorBox}>
              {errors.map((e, i) => (
                <Text key={i} style={styles.error}>
                  • {e}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Article'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  sizeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  sizeInput: { flex: 1 },
  removeSizeButton: { marginLeft: 8, padding: 8 },
  removeSizeText: { fontSize: 16, color: '#c0392b' },
  addSizeButton: { marginTop: 10 },
  addSizeText: { color: '#1a1a2e', fontWeight: '600', fontSize: 13 },
  errorBox: { marginTop: 16, backgroundColor: '#fdecea', borderRadius: 8, padding: 12 },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 2 },
  button: {
    marginTop: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
