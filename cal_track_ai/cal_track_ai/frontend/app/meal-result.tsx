import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useProcessing } from '../src/context/ProcessingContext';
import { Colors } from '../src/constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function MealResultScreen() {
  const { user } = useAuth();
  const { result, isSavingAuto, clearResult, saveMealAuto } = useProcessing();
  const router = useRouter();

  if (!result) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          {isSavingAuto ? (
            <>
              <ActivityIndicator size="large" color={Colors.brandPrimary} />
              <Text style={styles.savingText}>Saving your meal...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={60} color={Colors.success} />
              <Text style={styles.successText}>Meal saved successfully!</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="result-back-btn" onPress={() => {
            clearResult();
            router.back();
          }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nutrition</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Food image */}
        {result.image_base64 && (
          <Image
            source={{ uri: `data:image/jpeg;base64,${result.image_base64}` }}
            style={styles.foodImage}
          />
        )}

        {/* Food name (read-only) */}
        <Text style={styles.foodNameText}>{result.food_name}</Text>

        {result.meal_description ? (
          <Text style={styles.description}>{result.meal_description}</Text>
        ) : null}

        {/* Quantity display */}
        <View style={styles.quantityCard}>
          <Text style={styles.quantityLabel}>Quantity</Text>
          <Text style={styles.quantityValue}>{result.quantity_grams}g</Text>
        </View>

        {/* Calorie card */}
        <View style={styles.calorieCard}>
          <Text style={styles.calLabel}>Calories</Text>
          <Text style={styles.calValue}>{Math.round(result.calories)}</Text>
        </View>

        {/* Macro grid */}
        <View style={styles.macroRow}>
          <View style={[styles.macroCard, { borderTopColor: Colors.protein }]}>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>{result.protein.toFixed(1)}g</Text>
          </View>
          <View style={[styles.macroCard, { borderTopColor: Colors.carbs }]}>
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValue}>{result.carbs.toFixed(1)}g</Text>
          </View>
          <View style={[styles.macroCard, { borderTopColor: Colors.fats }]}>
            <Text style={styles.macroLabel}>Fats</Text>
            <Text style={styles.macroValue}>{result.fats.toFixed(1)}g</Text>
          </View>
        </View>

        {/* Fiber */}
        <View style={styles.fiberCard}>
          <Text style={styles.fiberLabel}>Fiber</Text>
          <Text style={styles.fiberValue}>{result.fiber.toFixed(1)}g</Text>
        </View>

        {/* Health score */}
        <View style={styles.healthCard}>
          <Text style={styles.healthLabel}>Health Score</Text>
          <View style={styles.healthBar}>
            <View style={[styles.healthFill, { width: `${((result.health_score || 5) / 10) * 100}%` }]} />
          </View>
          <Text style={styles.healthValue}>{result.health_score || 5}/10</Text>
        </View>

        {/* Ingredients */}
        {result.ingredients && result.ingredients.length > 0 && (
          <View style={styles.ingredientsSection}>
            <Text style={styles.ingredientsTitle}>Ingredients</Text>
            <View style={styles.tagRow}>
              {result.ingredients.map((ing: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{ing}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Auto-save status */}
        <View style={styles.autoSaveInfo}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.autoSaveText}>Auto-saving to today</Text>
        </View>

        {/* Manual save button (fallback) */}
        {error && (
          <>
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={async () => {
                try {
                  await saveMealAuto(user?.token || '');
                } catch (e) {
                  Alert.alert('Error', 'Failed to save');
                }
              }}
            >
              <Text style={styles.saveBtnText}>Save Anyway</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  savingText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 16 },
  successText: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  noResult: { color: Colors.textSecondary, fontSize: 16 },
  goBackBtn: { marginTop: 16, padding: 12 },
  goBackText: { color: Colors.brandPrimary, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  foodImage: { width: '100%', height: 200, borderRadius: 20, marginBottom: 16 },
  foodNameText: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  foodNameInput: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8 },
  description: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  quantityCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quantityLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  quantityValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyInput: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', width: 80 },
  qtyUnit: { fontSize: 18, color: Colors.textSecondary, fontWeight: '600' },
  calorieCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calLabel: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  calValue: { fontSize: 34, fontWeight: '900', color: Colors.textPrimary },
  macroRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  macroCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, alignItems: 'center' },
  macroLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  macroValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  fiberCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fiberLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  fiberValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  healthCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  healthLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  healthBar: { height: 8, backgroundColor: Colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  healthFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  healthValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right', marginTop: 8 },
  ingredientsSection: { marginBottom: 20 },
  ingredientsTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  tagText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  autoSaveInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(52, 211, 153, 0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.2)' },
  autoSaveText: { color: Colors.success, fontSize: 13, fontWeight: '600' },
  errorBanner: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: 12 },
  errorText: { color: Colors.error, fontSize: 13 },
  saveBtn: { backgroundColor: Colors.brandPrimary, borderRadius: 16, padding: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
