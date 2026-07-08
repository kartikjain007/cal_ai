import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface AnalysisResult {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  health_score: number;
  quantity_grams: number;
  ingredients: string[];
  meal_description: string;
  meal_type: string;
  image_base64: string;
}

interface ProcessingContextType {
  isProcessing: boolean;
  result: AnalysisResult | null;
  error: string | null;
  isSavingAuto: boolean;
  startAnalysis: (imageBase64: string, mealType: string, token: string) => void;
  clearResult: () => void;
  dismissError: () => void;
  saveMealAuto: (token: string) => Promise<void>;
  onMealSaved: () => void;
}

const getLocalTime = () => new Date().toISOString();

const ProcessingContext = createContext<ProcessingContextType>({
  isProcessing: false,
  result: null,
  error: null,
  isSavingAuto: false,
  startAnalysis: () => {},
  clearResult: () => {},
  dismissError: () => {},
  saveMealAuto: async () => {},
  onMealSaved: () => {},
});

export function useProcessing() {
  return useContext(ProcessingContext);
}

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSavingAuto, setIsSavingAuto] = useState(false);
  const [shouldNavigateHome, setShouldNavigateHome] = useState(false);
  const router = useRouter();

  const onMealSaved = useCallback(() => {
    setResult(null);
    setError(null);
    setShouldNavigateHome(true);
  }, []);

  const startAnalysis = useCallback((imageBase64: string, mealType: string, token: string) => {
    setIsProcessing(true);
    setResult(null);
    setError(null);

    axios.post(`${BACKEND_URL}/api/meals/analyze`, {
      image_base64: imageBase64,
      meal_type: mealType,
    }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 90000,
    }).then(async (res) => {
      const analysisResult = { ...res.data, image_base64: imageBase64 };
      setIsSavingAuto(true);
      try {
        await axios.post(`${BACKEND_URL}/api/meals`, {
          food_name: analysisResult.food_name,
          calories: Math.round(analysisResult.calories),
          protein: analysisResult.protein,
          carbs: analysisResult.carbs,
          fats: analysisResult.fats,
          fiber: analysisResult.fiber || 0,
          health_score: analysisResult.health_score || 5,
          quantity_grams: analysisResult.quantity_grams,
          ingredients: analysisResult.ingredients || [],
          meal_description: analysisResult.meal_description || '',
          meal_type: analysisResult.meal_type || 'snack',
          image_base64: analysisResult.image_base64 || '',
          logged_at: getLocalTime(),
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        onMealSaved();
      } catch (saveError: any) {
        const msg = saveError?.response?.data?.detail || 'Failed to save meal automatically.';
        setError(typeof msg === 'string' ? msg : 'Failed to save meal. Please try again.');
        setResult(analysisResult);
      } finally {
        setIsSavingAuto(false);
      }
    }).catch((e: any) => {
      const msg = e?.response?.data?.detail || 'Failed to analyze. Try again.';
      setError(typeof msg === 'string' ? msg : 'Please try with a clearer food photo.');
    }).finally(() => {
      setIsProcessing(false);
    });
  }, [onMealSaved]);

  const saveMealAuto = useCallback(async (token: string) => {
    if (!result) throw new Error('No analysis result available');
    setIsSavingAuto(true);
    try {
      await axios.post(`${BACKEND_URL}/api/meals`, {
        food_name: result.food_name,
        calories: Math.round(result.calories),
        protein: result.protein,
        carbs: result.carbs,
        fats: result.fats,
        fiber: result.fiber || 0,
        health_score: result.health_score || 5,
        quantity_grams: result.quantity_grams,
        ingredients: result.ingredients || [],
        meal_description: result.meal_description || '',
        meal_type: result.meal_type || 'snack',
        image_base64: result.image_base64 || '',
        logged_at: getLocalTime(),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onMealSaved();
    } finally {
      setIsSavingAuto(false);
    }
  }, [result, onMealSaved]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (shouldNavigateHome) {
      router.replace('/(tabs)/home');
      setShouldNavigateHome(false);
    }
  }, [shouldNavigateHome, router]);

  return (
    <ProcessingContext.Provider value={{ isProcessing, result, error, isSavingAuto, startAnalysis, clearResult, dismissError, saveMealAuto, onMealSaved }}>
      {children}
    </ProcessingContext.Provider>
  );
}
