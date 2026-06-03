import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface MealDetail {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  health_score: number;
  quantity_grams: number;
  meal_type: string;
  meal_description: string;
  ingredients: string[];
  image_base64: string;
  logged_at: string;
  created_at: string;
}

export default function MealDetailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Editable
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [baseQuantity, setBaseQuantity] = useState(100);
  const [baseCal, setBaseCal] = useState(0);
  const [basePro, setBasePro] = useState(0);
  const [baseCarbs, setBaseCarbs] = useState(0);
  const [baseFats, setBaseFats] = useState(0);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    fetchMeal();
  }, [id]);

  const fetchMeal = async () => {
    if (!id || !user?.token) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/api/meals/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const m = res.data;
      setMeal(m);
      setFoodName(m.food_name);
      setQuantity(m.quantity_grams || 100);
      setBaseQuantity(m.quantity_grams || 100);
      setBaseCal(m.calories);
      setBasePro(m.protein);
      setBaseCarbs(m.carbs);
      setBaseFats(m.fats);
    } catch {
      Alert.alert('Error', 'Failed to load meal details');
    } finally {
      setLoading(false);
    }
  };

  const ratio = baseQuantity > 0 ? quantity / baseQuantity : 1;
  const calories = Math.round(baseCal * ratio);
  const protein = Math.round(basePro * ratio);
  const carbs = Math.round(baseCarbs * ratio);
  const fats = Math.round(baseFats * ratio);

  const adjustQuantity = (delta: number) => {
    setQuantity(prev => Math.max(10, prev + delta));
    setEdited(true);
  };

  const handleSave = async () => {
    if (!meal) return;
    setSaving(true);
    try {
      await axios.put(`${BACKEND_URL}/api/meals/${meal.id}`, {
        food_name: foodName,
        quantity_grams: quantity,
        calories, protein, carbs, fats,
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      Alert.alert('Saved', 'Meal updated successfully');
      setEdited(false);
      setBaseQuantity(quantity);
      setBaseCal(calories);
      setBasePro(protein);
      setBaseCarbs(carbs);
      setBaseFats(fats);
    } catch {
      Alert.alert('Error', 'Failed to update meal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Meal', 'This will permanently remove this meal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await axios.delete(`${BACKEND_URL}/api/meals/${meal?.id}`, {
              headers: { Authorization: `Bearer ${user?.token}` }
            });
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete meal');
          } finally {
            setDeleting(false);
          }
        }
      },
    ]);
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.brandPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!meal) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.noResult}>Meal not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: Colors.brandPrimary, fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="detail-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meal Details</Text>
          <TouchableOpacity testID="delete-meal-btn" onPress={handleDelete} style={styles.deleteBtn}>
            {deleting ? <ActivityIndicator size="small" color={Colors.error} /> : <Ionicons name="trash-outline" size={22} color={Colors.error} />}
          </TouchableOpacity>
        </View>

        {/* Food image */}
        {meal.image_base64 && meal.image_base64.length > 50 && (
          <Image source={{ uri: `data:image/jpeg;base64,${meal.image_base64}` }} style={styles.foodImage} />
        )}

        {/* Scan time */}
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.timeText}>Scanned {formatDateTime(meal.logged_at)}</Text>
        </View>

        {/* Editable food name */}
        <TextInput
          testID="detail-food-name"
          style={styles.foodNameInput}
          value={foodName}
          onChangeText={t => { setFoodName(t); setEdited(true); }}
          placeholderTextColor={Colors.textDisabled}
        />

        {/* Meal type + description */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}</Text>
        </View>

        {meal.meal_description ? (
          <Text style={styles.description}>{meal.meal_description}</Text>
        ) : null}

        {/* Quantity adjuster */}
        <View style={styles.quantityCard}>
          <Text style={styles.quantityLabel}>Quantity</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity testID="detail-qty-decrease" style={styles.qtyBtn} onPress={() => adjustQuantity(-10)}>
              <Ionicons name="remove" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TextInput
              testID="detail-qty-input"
              style={styles.qtyInput}
              value={String(quantity)}
              onChangeText={t => { setQuantity(parseInt(t) || 0); setEdited(true); }}
              keyboardType="numeric"
            />
            <Text style={styles.qtyUnit}>g</Text>
            <TouchableOpacity testID="detail-qty-increase" style={styles.qtyBtn} onPress={() => adjustQuantity(10)}>
              <Ionicons name="add" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calories */}
        <View style={styles.calorieCard}>
          <Text style={styles.calLabel}>Calories</Text>
          <Text style={styles.calValue}>{calories}</Text>
        </View>

        {/* Macros */}
        <View style={styles.macroRow}>
          <View style={[styles.macroCard, { borderTopColor: Colors.protein }]}>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>{protein}g</Text>
          </View>
          <View style={[styles.macroCard, { borderTopColor: Colors.carbs }]}>
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValue}>{carbs}g</Text>
          </View>
          <View style={[styles.macroCard, { borderTopColor: Colors.fats }]}>
            <Text style={styles.macroLabel}>Fats</Text>
            <Text style={styles.macroValue}>{fats}g</Text>
          </View>
        </View>

        {/* Health score */}
        <View style={styles.healthCard}>
          <Text style={styles.healthLabel}>Health Score</Text>
          <View style={styles.healthBar}>
            <View style={[styles.healthFill, { width: `${(meal.health_score / 10) * 100}%` }]} />
          </View>
          <Text style={styles.healthValue}>{meal.health_score}/10</Text>
        </View>

        {/* Ingredients */}
        {meal.ingredients && meal.ingredients.length > 0 && (
          <View style={styles.ingredientsSection}>
            <Text style={styles.ingredientsTitle}>Ingredients</Text>
            <View style={styles.tagRow}>
              {meal.ingredients.map((ing, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{ing}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Save button (if edited) */}
        <TouchableOpacity 
          testID="save-updated-meal" 
          style={[styles.saveBtn, !edited && { opacity: 0.5 }]} 
          onPress={handleSave} 
          disabled={saving || !edited}
        >
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noResult: { color: Colors.textSecondary, fontSize: 16 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  foodImage: { width: '100%', height: 200, borderRadius: 20, marginBottom: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  timeText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  foodNameInput: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceElevated, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  typeText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  description: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  quantityCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  quantityLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', marginBottom: 10 },
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
  saveBtn: { backgroundColor: Colors.brandPrimary, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
