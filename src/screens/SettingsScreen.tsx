import React, { useCallback, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Application from 'expo-application';
import { useAuth } from '@/authentication/AuthContext';
import { AuthenticationService, AuthValidationError } from '@/services/AuthenticationService';
import { SettingsRepository } from '@/repositories/SettingsRepository';
import { INACTIVITY_TIMEOUT_OPTIONS } from '@/constants';
import { dualDatabaseManager } from '@/database/DualDatabaseManager';
import { DatabaseStatusReport } from '@/types';
import { ExcelExportService } from '@/services/ExcelExportService';
import { BackupService, RestoreValidationError } from '@/services/BackupService';

export function SettingsScreen() {
  const { userName, lockNow, refreshUserName } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [dbStatus, setDbStatus] = useState<DatabaseStatusReport | null>(null);

  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadAll = useCallback(async () => {
    const name = await SettingsRepository.getBusinessName();
    setBusinessName(name);
    const timeout = await SettingsRepository.getInactivityTimeoutMinutes();
    setTimeoutMinutes(timeout);
    const status = await dualDatabaseManager.getStatusReport();
    setDbStatus(status);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleBusinessNameBlur = async () => {
    await SettingsRepository.setBusinessName(businessName);
  };

  const handleTimeoutSelect = async (minutes: number) => {
    setTimeoutMinutes(minutes);
    await SettingsRepository.setInactivityTimeoutMinutes(minutes);
  };

  const handleChangePin = async () => {
    setPinError(null);
    setPinSaving(true);
    try {
      await AuthenticationService.changePin(currentPin, newPin, confirmNewPin);
      Alert.alert('PIN Changed', 'Your PIN has been updated.');
      setShowChangePin(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    } catch (err) {
      if (err instanceof AuthValidationError) {
        setPinError(err.message);
      } else {
        setPinError('Could not change PIN. Please try again.');
      }
    } finally {
      setPinSaving(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await ExcelExportService.exportAndShare();
    } catch {
      Alert.alert('Export Failed', 'Could not generate the Excel workbook.');
    } finally {
      setExporting(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      await BackupService.createBackup();
    } catch {
      Alert.alert('Backup Failed', 'Could not create a backup file.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore Data',
      'This will replace all current articles, bills, and inventory with the contents of the backup file you select. A safety backup of your current data will be created first. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Backup File',
          style: 'destructive',
          onPress: async () => {
            setRestoring(true);
            try {
              const uri = await BackupService.pickBackupFile();
              if (!uri) {
                setRestoring(false);
                return;
              }
              await BackupService.restoreFromFile(uri);
              Alert.alert('Restore Complete', 'Your data has been restored.');
              await loadAll();
            } catch (err) {
              if (err instanceof RestoreValidationError) {
                Alert.alert('Restore Failed', err.message);
              } else {
                Alert.alert('Restore Failed', 'The selected file could not be restored.');
              }
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <Section title="Profile">
          <Row label="Name" value={userName ?? '-'} />
          <Row label="Authentication" value="PIN protected" />
          <TouchableOpacity style={styles.link} onPress={() => setShowChangePin((v) => !v)}>
            <Text style={styles.linkText}>{showChangePin ? 'Cancel' : 'Change PIN'}</Text>
          </TouchableOpacity>
          {showChangePin && (
            <View style={styles.pinForm}>
              <TextInput
                style={styles.input}
                placeholder="Current PIN"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={4}
                value={currentPin}
                onChangeText={(t) => setCurrentPin(t.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={styles.input}
                placeholder="New PIN"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={4}
                value={newPin}
                onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm New PIN"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={4}
                value={confirmNewPin}
                onChangeText={(t) => setConfirmNewPin(t.replace(/[^0-9]/g, ''))}
              />
              {pinError && <Text style={styles.error}>{pinError}</Text>}
              <TouchableOpacity style={styles.button} onPress={handleChangePin} disabled={pinSaving}>
                <Text style={styles.buttonText}>{pinSaving ? 'Saving...' : 'Update PIN'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        <Section title="Business Information">
          <Text style={styles.label}>Business Name (shown on printed bills)</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            onBlur={handleBusinessNameBlur}
          />
        </Section>

        <Section title="Inactivity Timeout">
          {INACTIVITY_TIMEOUT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.minutes}
              style={styles.optionRow}
              onPress={() => handleTimeoutSelect(opt.minutes)}
            >
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Switch value={timeoutMinutes === opt.minutes} onValueChange={() => handleTimeoutSelect(opt.minutes)} />
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Database Status">
          <Row label="Primary Database" value={dbStatus?.primary.ok ? 'Healthy' : 'Unavailable'} />
          <Row label="Recovery Database" value={dbStatus?.secondary.ok ? 'Healthy' : 'Unavailable'} />
          <Row label="Active Database" value={dbStatus?.active === 'primary' ? 'Primary' : 'Recovery'} />
          <Row label="Synchronization" value={dbStatus?.synchronized ? 'Synchronized' : 'Synchronizing...'} />
          {dbStatus?.recoveryModeActive && (
            <View style={styles.recoveryBanner}>
              <Text style={styles.recoveryBannerText}>
                Primary database was unavailable. The app switched to the recovery database to keep
                your data safe.
              </Text>
            </View>
          )}
        </Section>

        <Section title="Data Management">
          <TouchableOpacity style={styles.button} onPress={handleExportExcel} disabled={exporting}>
            <Text style={styles.buttonText}>{exporting ? 'Exporting...' : 'Export Excel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonSpaced]} onPress={handleBackup} disabled={backingUp}>
            <Text style={styles.buttonText}>{backingUp ? 'Backing up...' : 'Backup Database'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSpaced, styles.dangerButton]}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Text style={styles.buttonText}>{restoring ? 'Restoring...' : 'Restore Data from Backup'}</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Application Information">
          <Row label="Version" value={Application.nativeApplicationVersion ?? '1.0.0'} />
          <Row label="Build" value={Application.nativeBuildVersion ?? '1'} />
        </Section>

        <TouchableOpacity style={styles.lockButton} onPress={lockNow}>
          <Text style={styles.lockButtonText}>Lock App Now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f9' },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 10, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 14, color: '#444' },
  rowValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  link: { marginTop: 6 },
  linkText: { color: '#1a1a2e', fontWeight: '600', fontSize: 13 },
  pinForm: { marginTop: 12 },
  label: { fontSize: 13, color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 8 },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionLabel: { fontSize: 14, color: '#333' },
  recoveryBanner: { backgroundColor: '#fff4e5', borderRadius: 8, padding: 10, marginTop: 10 },
  recoveryBannerText: { color: '#8a5a00', fontSize: 12 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonSpaced: { marginTop: 10 },
  dangerButton: { backgroundColor: '#7a2e2e' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  lockButton: { alignItems: 'center', paddingVertical: 16 },
  lockButtonText: { color: '#c0392b', fontWeight: '600', fontSize: 14 },
});
