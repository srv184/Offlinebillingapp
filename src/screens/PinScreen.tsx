import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/authentication/AuthContext';
import { NumericKeypad } from '@/components/NumericKeypad';
import { PinDots } from '@/components/PinDots';

export function PinScreen() {
  const { userName, unlock } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleDigit = async (digit: string) => {
    if (checking || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === 4) {
      setChecking(true);
      const ok = await unlock(next);
      setChecking(false);
      if (!ok) {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    }
  };

  const handleBackspace = () => {
    if (checking) return;
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.appName}>Offline Billing</Text>
        <Text style={styles.greeting}>{userName ? `Welcome back, ${userName}` : 'Enter your PIN'}</Text>

        <PinDots length={4} filled={pin.length} />

        {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorPlaceholder} />}

        <NumericKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  appName: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  greeting: { fontSize: 15, color: '#666', marginTop: 6 },
  error: { color: '#c0392b', fontSize: 13, height: 20 },
  errorPlaceholder: { height: 20 },
});
