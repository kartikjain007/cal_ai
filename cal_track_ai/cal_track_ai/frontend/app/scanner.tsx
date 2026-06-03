import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/context/AuthContext';
import { useProcessing } from '../src/context/ProcessingContext';
import { Colors } from '../src/constants/Colors';

export default function ScannerScreen() {
  const { user } = useAuth();
  const { startAnalysis, isProcessing } = useProcessing();
  const router = useRouter();
  const [mealType, setMealType] = useState('lunch');

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera access is required.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.7,
          base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
          startAnalysis(result.assets[0].base64, mealType, user?.token || '');
          router.back();
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Gallery access is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.7,
          base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
          startAnalysis(result.assets[0].base64, mealType, user?.token || '');
          router.back();
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="scanner-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Meal</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Meal type selector */}
        <View style={styles.mealTypeRow}>
          {mealTypes.map(type => (
            <TouchableOpacity
              key={type}
              testID={`meal-type-${type}`}
              style={[styles.mealTypeBtn, mealType === type && styles.mealTypeBtnActive]}
              onPress={() => setMealType(type)}
            >
              <Text style={[styles.mealTypeText, mealType === type && styles.mealTypeTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scanner UI */}
        <View style={styles.scannerFrame}>
          <Ionicons name="cloud-upload-outline" size={80} color={Colors.brandPrimary} />
          <Text style={styles.scannerText}>Upload a photo of your meal</Text>
          <Text style={styles.scannerSubtext}>AI will analyze the nutritional content in the background</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity testID="pick-from-gallery-btn" style={styles.actionBtn} onPress={() => pickImage(false)}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="images-outline" size={28} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionBtnText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="take-photo-btn" style={styles.captureBtn} onPress={() => pickImage(true)}>
            <Ionicons name="camera" size={36} color="#000" />
          </TouchableOpacity>

          <View style={{ width: 70, alignItems: 'center' }}>
            <View style={[styles.actionIconWrap, { opacity: 0.3 }]}>
              <Ionicons name="flash-outline" size={28} color={Colors.textPrimary} />
            </View>
            <Text style={[styles.actionBtnText, { opacity: 0.3 }]}>Flash</Text>
          </View>
        </View>

        {isProcessing && (
          <View style={styles.processingNote}>
            <Text style={styles.processingText}>A meal is being analyzed in the background...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 28, flexWrap: 'wrap' },
  mealTypeBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  mealTypeBtnActive: { backgroundColor: Colors.brandPrimary, borderColor: Colors.brandPrimary },
  mealTypeText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  mealTypeTextActive: { color: '#000' },
  scannerFrame: { flex: 1, backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  scannerText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  scannerSubtext: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, paddingBottom: 30 },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  actionBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.brandPrimary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  processingNote: { backgroundColor: 'rgba(200,255,0,0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(200,255,0,0.2)' },
  processingText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
