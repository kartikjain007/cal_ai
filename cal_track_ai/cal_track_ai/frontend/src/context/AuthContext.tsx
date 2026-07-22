import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  email: string;
  name: string;
  token: string;
  role: string;
  daily_calories: number;
  daily_protein: number;
  daily_carbs: number;
  daily_fats: number;
  onboarding_completed: boolean;
  goal_type?: 'lose' | 'maintain' | 'gain';
  diet_type?: string;
  age?: number;
  height_cm?: number;
  current_weight_kg?: number;
  target_weight_kg?: number;
  weekly_pace_kg?: number;
  target_date?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Verify token is still valid
        const res = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${parsed.token}` }
        });
        const updatedUser = { ...parsed, ...res.data, token: parsed.token };
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch {
      await AsyncStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
    const userData = res.data;
    setUser(userData);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await axios.post(`${BACKEND_URL}/api/auth/register`, { email, password, name });
    const userData = res.data;
    setUser(userData);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      if (user?.token) {
        await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
      }
    } catch {}
    setUser(null);
    await AsyncStorage.removeItem('user');
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      AsyncStorage.setItem('user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
