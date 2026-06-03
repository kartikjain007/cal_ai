import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import axios from 'axios';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const screenWidth = Dimensions.get('window').width - 48;

type Period = 'weekly' | 'monthly';

interface DayData {
  date: string;
  day_label: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  meal_count: number;
}

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/api/analytics/${period}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setData(res.data.days || []);
    } catch (e) {
      console.error('Analytics fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, period]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchAnalytics(); }, [fetchAnalytics]));

  const onRefresh = () => { setRefreshing(true); fetchAnalytics(); };

  const totalCals = data.reduce((s, d) => s + d.calories, 0);
  const totalProtein = data.reduce((s, d) => s + d.protein, 0);
  const totalCarbs = data.reduce((s, d) => s + d.carbs, 0);
  const totalFats = data.reduce((s, d) => s + d.fats, 0);
  const avgCals = data.length > 0 ? Math.round(totalCals / data.length) : 0;
  const daysLogged = data.filter(d => d.meal_count > 0).length;

  const chartLabels = period === 'weekly'
    ? data.map(d => d.day_label)
    : data.filter((_, i) => i % 5 === 0).map(d => d.day_label);

  const chartData = period === 'weekly'
    ? data.map(d => d.calories)
    : data.map(d => d.calories);

  const hasData = chartData.some(v => v > 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brandPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        testID="analytics-screen"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandPrimary} />}
      >
        <Text style={styles.title}>Analytics</Text>

        {/* Period toggle */}
        <View style={styles.periodRow}>
          {(['weekly', 'monthly'] as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              testID={`period-${p}`}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === 'weekly' ? '7 Days' : '30 Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{avgCals}</Text>
            <Text style={styles.summaryLabel}>Avg daily cal</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{daysLogged}</Text>
            <Text style={styles.summaryLabel}>Days logged</Text>
          </View>
        </View>

        {/* Calorie chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Calorie Intake</Text>
          {hasData ? (
            <LineChart
              data={{
                labels: period === 'weekly' ? chartLabels : chartLabels,
                datasets: [{ data: chartData.length > 0 ? chartData : [0] }],
              }}
              width={screenWidth - 16}
              height={200}
              withInnerLines={false}
              withOuterLines={false}
              withDots={true}
              bezier
              chartConfig={{
                backgroundColor: Colors.surface,
                backgroundGradientFrom: Colors.surface,
                backgroundGradientTo: Colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(200, 255, 0, ${opacity})`,
                labelColor: () => Colors.textSecondary,
                propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.brandPrimary },
                propsForBackgroundLines: { stroke: Colors.border },
              }}
              style={{ borderRadius: 16 }}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No data yet. Start logging meals!</Text>
            </View>
          )}
        </View>

        {/* Macro totals */}
        <View style={styles.macroSummary}>
          <Text style={styles.chartTitle}>Macro Totals ({period === 'weekly' ? '7 days' : '30 days'})</Text>
          <View style={styles.macroGrid}>
            <View style={[styles.macroCard, { borderLeftColor: Colors.protein }]}>
              <Text style={styles.macroValue}>{totalProtein}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={[styles.macroCard, { borderLeftColor: Colors.carbs }]}>
              <Text style={styles.macroValue}>{totalCarbs}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={[styles.macroCard, { borderLeftColor: Colors.fats }]}>
              <Text style={styles.macroValue}>{totalFats}g</Text>
              <Text style={styles.macroLabel}>Fats</Text>
            </View>
            <View style={[styles.macroCard, { borderLeftColor: Colors.brandPrimary }]}>
              <Text style={styles.macroValue}>{totalCals}</Text>
              <Text style={styles.macroLabel}>Total Cal</Text>
            </View>
          </View>
        </View>

        {daysLogged > 0 && (
          <View style={styles.motivationCard}>
            <Text style={styles.motivationText}>
              {daysLogged >= 5 ? "🔥 Great consistency! Keep it up!" :
               daysLogged >= 3 ? "💪 Good progress! You're building a habit!" :
               "🌱 Every meal logged counts. Keep going!"}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1, marginTop: 8, marginBottom: 20 },
  periodRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  periodBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  periodBtnActive: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  periodText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  periodTextActive: { color: Colors.background },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },
  chartCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  chartTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12, letterSpacing: -0.3 },
  noDataContainer: { height: 200, alignItems: 'center', justifyContent: 'center' },
  noDataText: { color: Colors.textDisabled, fontSize: 15 },
  macroSummary: { marginBottom: 20 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  macroCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4 },
  macroValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  macroLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  motivationCard: { backgroundColor: 'rgba(200,255,0,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(200,255,0,0.2)' },
  motivationText: { color: Colors.brandPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
