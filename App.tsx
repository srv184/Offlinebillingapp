import 'react-native-get-random-values';
import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDatabaseReady } from '@/hooks/useDatabaseReady';
import { AuthProvider } from '@/authentication/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';

/**
 * Startup order matters: the dual database manager must finish opening
 * both databases, run health checks, and complete any failover/recovery
 * BEFORE anything else (auth, settings, navigation) touches SQLite. This
 * component is the single gate for that.
 */
export default function App() {
  const { ready, error, status } = useDatabaseReady();

  if (error) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorTitle}>Database Unavailable</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorHint}>
            Restore a previous backup from a device that still has this app installed, or contact
            support with the recovery log from Settings.
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color="#1a1a2e" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      {status?.recoveryModeActive && null /* Settings screen surfaces this banner in detail */}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#c0392b', marginBottom: 8 },
  errorMessage: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 12 },
  errorHint: { fontSize: 12, color: '#888', textAlign: 'center' },
});
