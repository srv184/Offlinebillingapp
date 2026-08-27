import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function NumericKeypad({ onDigit, onBackspace }: Props) {
  return (
    <View style={styles.grid}>
      {KEYS.map((key, idx) => {
        if (key === '') return <View key={idx} style={styles.key} />;
        if (key === 'del') {
          return (
            <TouchableOpacity key={idx} style={styles.key} onPress={onBackspace}>
              <Text style={styles.keyText}>⌫</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity key={idx} style={styles.key} onPress={() => onDigit(key)}>
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 260, alignSelf: 'center' },
  key: {
    width: '33.33%',
    aspectRatio: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 26, fontWeight: '500', color: '#1a1a2e' },
});
