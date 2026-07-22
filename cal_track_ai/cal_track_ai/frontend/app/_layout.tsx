import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { ProcessingProvider, useProcessing } from '../src/context/ProcessingContext';
import { Colors } from '../src/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

function ProcessingToast() {
  const { isProcessing, result, error, dismissError, isSavingAuto } = useProcessing();
  const router = useRouter();

  // A ready `result` always needs a human decision before it's saved — it
  // either failed a plausibility check (Art. 14(2) review gate) or a prior
  // auto-save attempt errored and needs a retry. Route to the review screen
  // rather than saving it directly from the toast.
  const handleViewResult = () => {
    router.push('/meal-result');
  };

  if (!isProcessing && !result && !error) return null;

  if (error) {
    return (
      <View style={styles.toastContainer}>
        <View style={[styles.toast, styles.toastError]}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <Text style={styles.toastText} numberOfLines={1}>{error}</Text>
          <TouchableOpacity testID="dismiss-error-toast" onPress={dismissError}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isProcessing) {
    return (
      <View style={styles.toastContainer}>
        <View style={styles.toast}>
          <ActivityIndicator size="small" color={Colors.brandPrimary} />
          <Text style={styles.toastText}>Analyzing your meal...</Text>
        </View>
      </View>
    );
  }

  if (result) {
    return (
      <View style={styles.toastContainer}>
        <TouchableOpacity testID="view-result-toast" style={[styles.toast, styles.toastSuccess]} onPress={handleViewResult} disabled={isSavingAuto}>
          {isSavingAuto ? (
            <>
              <ActivityIndicator size="small" color={Colors.success} />
              <Text style={styles.toastText}>Saving meal...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.toastText}>Analysis ready! Tap to review</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProcessingProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: 'slide_from_right',
            }}
          />
          <ProcessingToast />
        </ProcessingProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastSuccess: {
    borderColor: 'rgba(52,199,89,0.3)',
  },
  toastError: {
    borderColor: 'rgba(255,59,48,0.3)',
  },
  toastText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
