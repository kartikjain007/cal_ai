import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const [calories, setCalories] = useState(String(user?.daily_calories || 2000));
  const [protein, setProtein] = useState(String(user?.daily_protein || 150));
  const [carbs, setCarbs] = useState(String(user?.daily_carbs || 250));
  const [fats, setFats] = useState(String(user?.daily_fats || 65));
  const [saving, setSaving] = useState(false);

  const handleSaveGoals = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${BACKEND_URL}/api/user/goals`, {
        daily_calories: parseInt(calories) || 2000,
        daily_protein: parseInt(protein) || 150,
        daily_carbs: parseInt(carbs) || 250,
        daily_fats: parseInt(fats) || 65,
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      updateUser({
        daily_calories: res.data.daily_calories,
        daily_protein: res.data.daily_protein,
        daily_carbs: res.data.daily_carbs,
        daily_fats: res.data.daily_fats,
      });
      Alert.alert('Success', 'Goals updated successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save goals');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/login');
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView testID="settings-screen" style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Settings</Text>

          {/* Profile */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color={Colors.textPrimary} />
            </View>
            <View>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            </View>
          </View>

          {/* Goals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DAILY GOALS</Text>

            <View style={styles.goalRow}>
              <View style={styles.goalLabelRow}>
                <Text style={styles.goalIcon}>🔥</Text>
                <Text style={styles.goalLabel}>Calories</Text>
              </View>
              <TextInput
                testID="goal-calories-input"
                style={styles.goalInput}
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholder="2000"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>

            <View style={styles.goalRow}>
              <View style={styles.goalLabelRow}>
                <Text style={styles.goalIcon}>⚡</Text>
                <Text style={[styles.goalLabel, { color: Colors.protein }]}>Protein (g)</Text>
              </View>
              <TextInput
                testID="goal-protein-input"
                style={styles.goalInput}
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="150"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>

            <View style={styles.goalRow}>
              <View style={styles.goalLabelRow}>
                <Text style={styles.goalIcon}>🌾</Text>
                <Text style={[styles.goalLabel, { color: Colors.carbs }]}>Carbs (g)</Text>
              </View>
              <TextInput
                testID="goal-carbs-input"
                style={styles.goalInput}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholder="250"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>

            <View style={styles.goalRow}>
              <View style={styles.goalLabelRow}>
                <Text style={styles.goalIcon}>💧</Text>
                <Text style={[styles.goalLabel, { color: Colors.fats }]}>Fats (g)</Text>
              </View>
              <TextInput
                testID="goal-fats-input"
                style={styles.goalInput}
                value={fats}
                onChangeText={setFats}
                keyboardType="numeric"
                placeholder="65"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>

            <TouchableOpacity testID="save-goals-button" style={styles.saveBtn} onPress={handleSaveGoals} disabled={saving}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save Goals</Text>}
            </TouchableOpacity>
          </View>

          {/* Human oversight console (Art. 14(2)) — review queue + AI kill-switch, admin only */}
          {user?.role === 'admin' && (
            <TouchableOpacity
              testID="admin-review-link"
              style={styles.adminBtn}
              onPress={() => router.push('/admin-review')}
            >
              <Ionicons name="shield-checkmark-outline" size={22} color={Colors.brandPrimary} />
              <Text style={styles.adminBtnText}>Human Oversight Console</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Logout */}
          <TouchableOpacity testID="logout-button" style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <Text style={styles.version}>Cal AI v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1, marginTop: 8, marginBottom: 24 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginBottom: 28, borderWidth: 1, borderColor: Colors.border, gap: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  profileEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.5, marginBottom: 16 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  goalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalIcon: { fontSize: 18 },
  goalLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  goalInput: { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 10, width: 80, textAlign: 'center', color: Colors.textPrimary, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.brandPrimary, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  adminBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)', marginBottom: 20 },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.error },
  version: { textAlign: 'center', color: Colors.textDisabled, fontSize: 13, marginBottom: 20 },
});
