import React from 'react';
import { StyleSheet, View } from 'react-native';

export function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => (
        <View key={i} style={[styles.dot, i < filled ? styles.dotFilled : undefined]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 24 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#999',
    marginHorizontal: 8,
  },
  dotFilled: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
});
