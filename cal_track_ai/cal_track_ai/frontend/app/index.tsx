import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/Colors';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.onboarding_completed) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/onboarding' as never);
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading]);

  return (
    <View testID="splash-screen" style={styles.container}>
      <ActivityIndicator size="large" color={Colors.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
});
