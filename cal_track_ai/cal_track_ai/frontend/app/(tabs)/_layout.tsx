import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function TabLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && !user.onboarding_completed) {
      router.replace('/onboarding' as never);
    }
  }, [user, loading, router]);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 80, // Increased height for the custom layout
            paddingBottom: 20,
            paddingTop: 8,
            paddingRight: 80, // Leave space for the floating upload button
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
            borderTopRightRadius: 24,
            borderTopLeftRadius: 24,
          },
          tabBarActiveTintColor: Colors.textPrimary,
          tabBarInactiveTintColor: Colors.textDisabled,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 4 },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={focused ? styles.activeTabIcon : null}>
                <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={26} color={color} />
            ),
          }}
        />
      </Tabs>
      
      {/* Floating Upload Button */}
      <TouchableOpacity 
        style={styles.uploadButton}
        onPress={() => router.push('/scanner')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
        <Text style={styles.uploadText}>Delete</Text> 
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  activeTabIcon: {
    backgroundColor: '#F3E8DC', // Based on the screenshot's Home tab background
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  uploadButton: {
    position: 'absolute',
    bottom: 12,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  uploadText: {
    position: 'absolute',
    bottom: -15,
    fontSize: 10,
    color: '#000',
    fontWeight: 'bold',
    opacity: 0, // Hidden visually but there for reference if needed
  }
});
