import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Switch, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ReviewItem {
  entity_type: 'meal' | 'exercise' | 'water_log';
  id: string;
  user_id: string;
  user_email: string;
  summary: string;
  confidence: number | null;
  logged_at: string | null;
  created_at: string;
}

// Human-oversight admin console (Art. 14(2)): lets an authorized reviewer
// inspect records the automated plausibility checks flagged, resolve them,
// and use the kill-switch to stop the AI meal-analysis pipeline entirely.
// Every action here calls the audited /api/admin/* routes
// (server/src/routes/admin.ts), which log a ReviewAction row per decision.
export default function AdminReviewScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [togglingKillSwitch, setTogglingKillSwitch] = useState(false);
  const [stopReasonPromptOpen, setStopReasonPromptOpen] = useState(false);
  const [stopReason, setStopReason] = useState('');

  const authHeaders = { headers: { Authorization: `Bearer ${user?.token}` } };

  const load = useCallback(async () => {
    try {
      const [queueRes, statusRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/review-queue`, authHeaders),
        axios.get(`${BACKEND_URL}/api/admin/oversight/status`, authHeaders),
      ]);
      setItems(queueRes.data.items);
      setAiEnabled(statusRes.data.ai_analysis_enabled);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to load review queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleDecision = async (item: ReviewItem, decision: 'approved' | 'rejected') => {
    const key = `${item.entity_type}:${item.id}`;
    setBusyKey(key);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/review-queue/${item.entity_type}/${item.id}/decision`,
        { decision },
        authHeaders
      );
      setItems((prev) => prev.filter((i) => !(i.entity_type === item.entity_type && i.id === item.id)));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to record decision');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleKillSwitch = (next: boolean) => {
    if (next) {
      applyKillSwitch(true);
      return;
    }
    setStopReason('');
    setStopReasonPromptOpen(true);
  };

  const confirmStop = () => {
    if (!stopReason.trim()) {
      Alert.alert('Reason required', 'A reason is required to stop AI analysis.');
      return;
    }
    setStopReasonPromptOpen(false);
    applyKillSwitch(false, stopReason.trim());
  };

  const applyKillSwitch = async (enabled: boolean, reason?: string) => {
    setTogglingKillSwitch(true);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/oversight/status`,
        { enabled, reason },
        authHeaders
      );
      setAiEnabled(res.data.ai_analysis_enabled);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to update AI analysis status');
    } finally {
      setTogglingKillSwitch(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={Colors.textSecondary} />
          <Text style={styles.deniedText}>Admin access required</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Human Oversight</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.textPrimary} />}
      >
        <View style={styles.killSwitchCard}>
          <View style={styles.killSwitchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.killSwitchTitle}>AI meal analysis</Text>
              <Text style={styles.killSwitchSubtitle}>
                {aiEnabled === false ? 'Stopped — no images are being sent to the model' : 'Running'}
              </Text>
            </View>
            {aiEnabled === null || togglingKillSwitch ? (
              <ActivityIndicator color={Colors.brandPrimary} />
            ) : (
              <Switch
                testID="kill-switch-toggle"
                value={aiEnabled}
                onValueChange={handleToggleKillSwitch}
                trackColor={{ true: Colors.brandPrimary, false: Colors.surfaceElevated }}
              />
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>FLAGGED FOR REVIEW ({items.length})</Text>

        {loading ? (
          <ActivityIndicator color={Colors.brandPrimary} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>Nothing flagged right now.</Text>
        ) : (
          items.map((item) => {
            const key = `${item.entity_type}:${item.id}`;
            const isBusy = busyKey === key;
            return (
              <View key={key} style={styles.itemCard}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemType}>{item.entity_type.replace('_', ' ')}</Text>
                  <Text style={styles.itemUser}>{item.user_email}</Text>
                </View>
                <Text style={styles.itemSummary}>{item.summary}</Text>
                {item.confidence !== null && (
                  <Text style={styles.itemMeta}>model confidence: {item.confidence.toFixed(2)}</Text>
                )}
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    testID={`approve-${key}`}
                    style={[styles.actionBtn, styles.approveBtn]}
                    disabled={isBusy}
                    onPress={() => handleDecision(item, 'approved')}
                  >
                    {isBusy ? <ActivityIndicator color={Colors.success} /> : <Text style={styles.approveBtnText}>Approve</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`reject-${key}`}
                    style={[styles.actionBtn, styles.rejectBtn]}
                    disabled={isBusy}
                    onPress={() => handleDecision(item, 'rejected')}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={stopReasonPromptOpen} transparent animationType="fade" onRequestClose={() => setStopReasonPromptOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Stop AI meal analysis</Text>
            <Text style={styles.modalSubtitle}>
              This immediately blocks AI meal analysis for every user. Enter a reason for the audit log.
            </Text>
            <TextInput
              testID="stop-reason-input"
              style={styles.modalInput}
              value={stopReason}
              onChangeText={setStopReason}
              placeholder="e.g. investigating a spike in bad estimates"
              placeholderTextColor={Colors.textDisabled}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setStopReasonPromptOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-stop-btn" style={styles.modalConfirmBtn} onPress={confirmStop}>
                <Text style={styles.modalConfirmText}>Stop analysis</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  deniedText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  killSwitchCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  killSwitchRow: { flexDirection: 'row', alignItems: 'center' },
  killSwitchTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  killSwitchSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.5, marginBottom: 14 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },
  itemCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemType: { fontSize: 12, fontWeight: '700', color: Colors.brandPrimary, textTransform: 'uppercase' },
  itemUser: { fontSize: 12, color: Colors.textSecondary },
  itemSummary: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  itemMeta: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },
  itemActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  approveBtn: { backgroundColor: 'rgba(52, 199, 89, 0.1)', borderColor: 'rgba(52, 199, 89, 0.3)' },
  approveBtnText: { color: Colors.success, fontWeight: '700' },
  rejectBtn: { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderColor: 'rgba(255, 59, 48, 0.3)' },
  rejectBtnText: { color: Colors.error, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  modalInput: { backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 14, minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: Colors.surfaceElevated },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '700' },
  modalConfirmBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: Colors.error },
  modalConfirmText: { color: '#FFF', fontWeight: '700' },
});
