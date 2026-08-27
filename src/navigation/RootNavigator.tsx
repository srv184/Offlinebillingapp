import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '@/authentication/AuthContext';
import { SetupScreen } from '@/screens/SetupScreen';
import { PinScreen } from '@/screens/PinScreen';
import { BottomTabNavigator } from '@/navigation/BottomTabNavigator';

/**
 * Assumes the database has already been initialized by the caller (see
 * App.tsx) -- AuthenticationService reads/writes app_settings, so it must
 * not run until dualDatabaseManager.initialize() has resolved.
 */
export function RootNavigator() {
  const { loading: authLoading, isSetupComplete, isLocked } = useAuth();

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      {!isSetupComplete ? <SetupScreen /> : isLocked ? <PinScreen /> : <BottomTabNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
});
