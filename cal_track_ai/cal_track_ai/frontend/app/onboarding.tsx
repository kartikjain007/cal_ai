import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import { useAuth } from '../src/context/AuthContext';

type GoalType = 'lose' | 'maintain' | 'gain';
type DietType = 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const GOAL_OPTIONS: { key: GoalType; title: string; subtitle: string }[] = [
  { key: 'lose', title: 'Lose weight', subtitle: 'Create a fat-loss plan with a calorie deficit.' },
  { key: 'maintain', title: 'Maintain', subtitle: 'Keep your current shape with balanced targets.' },
  { key: 'gain', title: 'Gain weight', subtitle: 'Build in a controlled calorie surplus.' },
];

const DIET_OPTIONS: { key: DietType; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'omnivore', title: 'Omnivore', icon: 'restaurant-outline' },
  { key: 'pescatarian', title: 'Pescatarian', icon: 'fish-outline' },
  { key: 'vegetarian', title: 'Vegetarian', icon: 'leaf-outline' },
  { key: 'vegan', title: 'Vegan', icon: 'flower-outline' },
];

const PACE_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 0.25, label: 'Slow', hint: 'Easier to sustain' },
  { value: 0.5, label: 'Recommended', hint: 'Balanced speed' },
  { value: 0.9, label: 'Fast', hint: 'Higher discipline needed' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.onboarding_completed) {
      router.replace('/(tabs)/home');
    }
  }, [user, router]);

  const totalSteps = 6;
  const [step, setStep] = useState(0);

  const [goalType, setGoalType] = useState<GoalType>('lose');
  const [age, setAge] = useState('25');
  const [heightCm, setHeightCm] = useState('170');
  const [currentWeight, setCurrentWeight] = useState('65');
  const [targetWeight, setTargetWeight] = useState('60');
  const [weeklyPace, setWeeklyPace] = useState<number>(0.5);
  const [dietType, setDietType] = useState<DietType>('omnivore');

  const [submitting, setSubmitting] = useState(false);

  const contentAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value((step + 1) / totalSteps)).current;
  const lastHapticAt = useRef(0);

  const progress = (step + 1) / totalSteps;
  const ageOptions = useMemo(() => Array.from({ length: 88 }, (_, index) => String(index + 13)), []);
  const heightOptions = useMemo(() => Array.from({ length: 151 }, (_, index) => String(index + 100)), []);
  const weightOptions = useMemo(() => Array.from({ length: 271 }, (_, index) => String(index + 30)), []);

  useMemo(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const transitionToStep = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(contentAnim, {
        toValue: 0,
        duration: 130,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    setStep(nextStep);
  };

  const parseNumber = (value: string) => Number(value.trim());

  const triggerPickerHaptic = () => {
    const now = Date.now();
    if (now - lastHapticAt.current < 45) {
      return;
    }
    lastHapticAt.current = now;

    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => undefined);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const validateCurrentStep = (): boolean => {
    if (step === 1) {
      const ageNumber = parseNumber(age);
      const heightNumber = parseNumber(heightCm);
      const weightNumber = parseNumber(currentWeight);
      if (!Number.isFinite(ageNumber) || ageNumber < 13 || ageNumber > 100) {
        Alert.alert('Invalid age', 'Enter a valid age between 13 and 100.');
        return false;
      }
      if (!Number.isFinite(heightNumber) || heightNumber < 100 || heightNumber > 250) {
        Alert.alert('Invalid height', 'Enter your height in cm (100 to 250).');
        return false;
      }
      if (!Number.isFinite(weightNumber) || weightNumber < 30 || weightNumber > 300) {
        Alert.alert('Invalid weight', 'Enter your current weight in kg (30 to 300).');
        return false;
      }
    }

    if (step === 2) {
      const target = parseNumber(targetWeight);
      if (!Number.isFinite(target) || target < 30 || target > 300) {
        Alert.alert('Invalid target', 'Enter your target weight in kg (30 to 300).');
        return false;
      }
    }

    return true;
  };

  const submitOnboarding = async () => {
    if (!user?.token) {
      Alert.alert('Session expired', 'Please log in again.');
      router.replace('/login');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        goal_type: goalType,
        diet_type: dietType,
        age: parseNumber(age),
        height_cm: parseNumber(heightCm),
        current_weight_kg: parseNumber(currentWeight),
        target_weight_kg: parseNumber(targetWeight),
        weekly_pace_kg: weeklyPace,
      };

      const res = await axios.put(`${BACKEND_URL}/api/user/onboarding`, payload, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      updateUser({ ...res.data, token: user.token });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      Alert.alert('Unable to save setup', typeof detail === 'string' ? detail : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (!validateCurrentStep()) return;

    if (step < totalSteps - 1) {
      transitionToStep(step + 1);
      return;
    }

    submitOnboarding();
  };

  const handleBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    transitionToStep(step - 1);
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <View>
          <Text style={styles.title}>What is your goal?</Text>
          <Text style={styles.subtitle}>We use this to build your calorie and macro plan.</Text>
          <View style={styles.stack}>
            {GOAL_OPTIONS.map((option) => {
              const active = option.key === goalType;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setGoalType(option.key)}
                  style={[styles.optionCard, active && styles.optionCardActive]}
                >
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{option.title}</Text>
                  <Text style={[styles.optionSubtitle, active && styles.optionSubtitleActive]}>{option.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <Text style={styles.title}>Tell us about your body</Text>
          <Text style={styles.subtitle}>Age, height, and current weight help us personalize your plan.</Text>
          <View style={styles.pickerRow}>
            <PickerField
              label="Age"
              unit="yr"
              value={age}
              options={ageOptions}
              onChange={(nextValue) => {
                if (nextValue === age) return;
                setAge(nextValue);
                triggerPickerHaptic();
              }}
            />
            <PickerField
              label="Height"
              unit="cm"
              value={heightCm}
              options={heightOptions}
              onChange={(nextValue) => {
                if (nextValue === heightCm) return;
                setHeightCm(nextValue);
                triggerPickerHaptic();
              }}
            />
            <PickerField
              label="Weight"
              unit="kg"
              value={currentWeight}
              options={weightOptions}
              onChange={(nextValue) => {
                if (nextValue === currentWeight) return;
                setCurrentWeight(nextValue);
                triggerPickerHaptic();
              }}
            />
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <Text style={styles.title}>What is your desired weight?</Text>
          <Text style={styles.subtitle}>Set a realistic target. You can adjust this anytime.</Text>
          <View style={styles.pickerRow}>
            <PickerField
              label="Target"
              unit="kg"
              value={targetWeight}
              options={weightOptions}
              onChange={(nextValue) => {
                if (nextValue === targetWeight) return;
                setTargetWeight(nextValue);
                triggerPickerHaptic();
              }}
            />
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View>
          <Text style={styles.title}>How fast do you want to reach it?</Text>
          <Text style={styles.subtitle}>Pick your preferred weekly pace.</Text>

          <View style={styles.paceRow}>
            {PACE_OPTIONS.map((option) => {
              const active = weeklyPace === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setWeeklyPace(option.value)}
                  style={[styles.paceCard, active && styles.paceCardActive]}
                >
                  <Text style={[styles.paceLabel, active && styles.paceLabelActive]}>{option.label}</Text>
                  <Text style={[styles.paceValue, active && styles.paceValueActive]}>{option.value} kg/week</Text>
                  <Text style={[styles.paceHint, active && styles.paceHintActive]}>{option.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 4) {
      return (
        <View>
          <Text style={styles.title}>Do you follow a specific diet?</Text>
          <Text style={styles.subtitle}>This helps us tailor food recommendations.</Text>
          <View style={styles.stack}>
            {DIET_OPTIONS.map((option) => {
              const active = dietType === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setDietType(option.key)}
                  style={[styles.dietCard, active && styles.dietCardActive]}
                >
                  <View style={[styles.iconCircle, active && styles.iconCircleActive]}>
                    <Ionicons name={option.icon} size={20} color={active ? '#FFFFFF' : '#111827'} />
                  </View>
                  <Text style={[styles.dietText, active && styles.dietTextActive]}>{option.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    const delta = (parseNumber(currentWeight) - parseNumber(targetWeight)).toFixed(1);
    const planText = goalType === 'maintain' ? 'Maintain your current weight' : `${goalType === 'lose' ? 'Lose' : 'Gain'} ${Math.abs(Number(delta))} kg`;

    return (
      <View>
        <Text style={styles.title}>Your custom plan is ready</Text>
        <Text style={styles.subtitle}>Review and save your setup.</Text>

        <View style={styles.summaryCard}>
          <SummaryRow label="Goal" value={planText} />
          <SummaryRow label="Diet" value={dietType} />
          <SummaryRow label="Age" value={`${age} years`} />
          <SummaryRow label="Height" value={`${heightCm} cm`} />
          <SummaryRow label="Current" value={`${currentWeight} kg`} />
          <SummaryRow label="Target" value={`${targetWeight} kg`} />
          <SummaryRow label="Pace" value={`${weeklyPace} kg/week`} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </Pressable>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[
              {
                opacity: contentAnim,
                transform: [
                  {
                    translateY: contentAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {renderStep()}
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomWrap}>
          <Pressable
            onPress={handleContinue}
            style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>{step === totalSteps - 1 ? 'Finish setup' : 'Continue'}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type PickerFieldProps = {
  label: string;
  unit: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

function PickerField({ label, unit, value, options, onChange }: PickerFieldProps) {
  return (
    <View style={styles.pickerCard}>
      <Text style={styles.pickerTitle}>{label}</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={value}
          onValueChange={(itemValue) => onChange(String(itemValue))}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {options.map((option) => (
            <Picker.Item key={option} label={option} value={option} color="#111827" />
          ))}
        </Picker>
      </View>
      <Text style={styles.pickerUnit}>{unit}</Text>
    </View>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEEF3',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DFE2E8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#201A2F',
    borderRadius: 3,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '600',
    color: '#0B0B0D',
  },
  subtitle: {
    marginTop: 5,
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '500',
  },
  stack: {
    marginTop: 30,
    gap: 14,
  },
  optionCard: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#E9ECF3',
    borderWidth: 1,
    borderColor: '#E1E5EE',
  },
  optionCardActive: {
    backgroundColor: '#0D0D11',
    borderColor: '#0D0D11',
  },
  optionTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#111827',
  },
  optionTitleActive: {
    color: '#FFFFFF',
  },
  optionSubtitle: {
    marginTop: 7,
    color: '#6B7280',
    fontSize: 14,
  },
  optionSubtitleActive: {
    color: '#D1D5DB',
  },
  pickerRow: {
    marginTop: 30,
    flexDirection: 'row',
    gap: 10,
  },
  pickerCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 10,
    paddingHorizontal: Platform.OS === 'ios' ? 2 : 8,
    paddingBottom: 10,
    alignItems: 'center',
  },
  pickerTitle: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerWrap: {
    width: '100%',
    marginTop: 2,
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 170 : 56,
    transform: Platform.OS === 'ios' ? [{ scaleX: 1 }] : undefined,
  },
  pickerItem: {
    color: '#111827',
    fontSize: Platform.OS === 'ios' ? 20 : 18,
    fontWeight: Platform.OS === 'ios' ? '500' : '700',
  },
  pickerUnit: {
    marginTop: Platform.OS === 'ios' ? -8 : 4,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  paceRow: {
    marginTop: 30,
    gap: 12,
  },
  paceCard: {
    borderRadius: 20,
    backgroundColor: '#E9ECF3',
    borderWidth: 1,
    borderColor: '#E1E5EE',
    padding: 16,
  },
  paceCardActive: {
    backgroundColor: '#FFE7D4',
    borderColor: '#F9CDA8',
  },
  paceLabel: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  paceLabelActive: {
    color: '#9A5A29',
  },
  paceValue: {
    marginTop: 2,
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  paceValueActive: {
    color: '#9A5A29',
  },
  paceHint: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 13,
  },
  paceHintActive: {
    color: '#B06A34',
  },
  dietCard: {
    borderRadius: 18,
    backgroundColor: '#E9ECF3',
    borderWidth: 1,
    borderColor: '#E1E5EE',
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dietCardActive: {
    backgroundColor: '#1D1828',
    borderColor: '#1D1828',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  iconCircleActive: {
    backgroundColor: '#D79461',
  },
  dietText: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dietTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    marginTop: 30,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: '#F1F5F9',
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  summaryLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  bottomWrap: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: '#F3F4F6',
  },
  continueButton: {
    height: 62,
    borderRadius: 31,
    backgroundColor: '#1E1830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
