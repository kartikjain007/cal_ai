import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, FlatList, Image, Alert, Dimensions, LayoutAnimation, UIManager, Platform, Modal } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../src/context/AuthContext';
import { useProcessing } from '../../src/context/ProcessingContext';
import { Colors } from '../../src/constants/Colors';
import CalorieRing from '../../src/components/CalorieRing';
import MacroRing from '../../src/components/MacroRing';
import { connectHealth, getTodaySteps } from '../../src/services/HealthService';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Summary {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  meal_count: number;
  goal_calories: number;
  goal_protein: number;
  goal_carbs: number;
  goal_fats: number;
}

interface TimelineItem {
  id: string;
  type: 'meal' | 'water' | 'exercise';
  logged_at: string;
  // Meal fields
  food_name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
  health_score?: number;
  quantity_grams?: number;
  meal_type?: string;
  meal_description?: string;
  ingredients?: string[];
  image_base64?: string;
  // Water fields
  amount_ml?: number;
  // Exercise fields
  exercise_name?: string;
  duration_minutes?: number;
  calories_burned?: number;
}

const SwipeableTimelineItem = ({ item, renderRightActions, handleSwipeDelete, children }: any) => {
  const swipeableRef = useRef<any>(null);

  const triggerDelete = () => {
    handleSwipeDelete(item.id, item.type, item);
    swipeableRef.current?.close();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      key={`${item.type}-${item.id}`}
      rightThreshold={40}
      renderRightActions={(progress, drag) => renderRightActions(progress, drag, item.id, item.type, triggerDelete)}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') {
          triggerDelete();
        }
      }}
    >
      {children}
    </Swipeable>
  );
};

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateScrollRef = useRef<ScrollView>(null);
  const [swipedMeal, setSwipedMeal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showEaten, setShowEaten] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [updating, setUpdating] = useState(false);
  const { isSavingAuto } = useProcessing();

  const calorieAnim = useSharedValue(0);
  const calorieOpacity = useSharedValue(1);
  const calorieScale = useSharedValue(1);

  const animateCalorieValue = (toValue: number) => {
    calorieOpacity.value = withSequence(
      withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
    );
    calorieScale.value = withSequence(
      withTiming(0.8, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
    );
  };

  const toggleShowEaten = () => {
    animateCalorieValue(caloriesLeft);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEaten(prev => !prev);
  };

  // Exercise Logging State
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [exerciseDuration, setExerciseDuration] = useState(15); // Default 15 mins
  const [loggedExercises, setLoggedExercises] = useState<{ name: string, cal: number }[]>([]);

  // Water Logging State
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [waterAmount, setWaterAmount] = useState(250);
  const [totalWater, setTotalWater] = useState(0);
  const [waterDetailModalVisible, setWaterDetailModalVisible] = useState(false);
  const [exerciseDetailModalVisible, setExerciseDetailModalVisible] = useState(false);
  const [mealDetailModalVisible, setMealDetailModalVisible] = useState(false);
  const [selectedMealItem, setSelectedMealItem] = useState<TimelineItem | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(100);
  const [editBaseCal, setEditBaseCal] = useState<number>(0);
  const [editBasePro, setEditBasePro] = useState<number>(0);
  const [editBaseCarbs, setEditBaseCarbs] = useState<number>(0);
  const [editBaseFats, setEditBaseFats] = useState<number>(0);
  const [mealEdited, setMealEdited] = useState(false);

  // Health & Water State
  const [healthConnected, setHealthConnected] = useState(false);
  const [steps, setSteps] = useState(0);
  const handleConnectHealth = async () => {
    // const success = await initHealthConnect();
    // if (success) {
    //   setHealthConnected(true);
    //   const stepsCount = await getTodaySteps();
    //   setSteps(stepsCount);
    // } else {
    //   Alert.alert('Error', 'Could not connect to health tracking.');
    // }
    Alert.alert('Coming Soon', 'Apple Health integration is coming soon!');
  };

  const EXERCISES = [
    { id: '1', name: 'Running', calPerMin: 10 },
    { id: '2', name: 'Cycling', calPerMin: 8 },
    { id: '3', name: 'Swimming', calPerMin: 11 },
    { id: '4', name: 'Weight lifting', calPerMin: 6 },
    { id: '5', name: 'Yoga', calPerMin: 4 },
    { id: '6', name: 'HIIT', calPerMin: 12 },
    { id: '7', name: 'Walking', calPerMin: 5 },
    { id: '8', name: 'Jump Rope', calPerMin: 14 },
    { id: '9', name: 'Rowing', calPerMin: 9 },
    { id: '10', name: 'Stair Climber', calPerMin: 8 },
  ];

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const offset = event.nativeEvent.contentOffset.x;
    const page = Math.round(offset / slideSize);
    if (page !== activePage) setActivePage(page);
  };

  const handleAddExercise = async () => {
    if (selectedExercise && user?.token) {
      const burned = selectedExercise.calPerMin * exerciseDuration;
      const localTime = new Date().toISOString();
      try {
        await axios.post(`${BACKEND_URL}/api/activities/exercises`, {
          exercise_name: selectedExercise.name,
          duration_minutes: exerciseDuration,
          calories_burned: burned,
          logged_at: localTime
        }, { headers: { Authorization: `Bearer ${user.token}` } });

        setExerciseModalVisible(false);
        setSelectedExercise(null);
        setExerciseDuration(15);
        fetchData(); // Refresh list
      } catch (e) {
        Alert.alert('Error', 'Failed to log exercise');
      }
    }
  };

  const handleAddWater = async () => {
    if (user?.token) {
      try {
        const localTime = new Date().toISOString();
        await axios.post(`${BACKEND_URL}/api/activities/water`, {
          amount_ml: waterAmount,
          logged_at: localTime
        }, { headers: { Authorization: `Bearer ${user.token}` } });

        setWaterModalVisible(false);
        fetchData(); // Refresh list
      } catch (e) {
        Alert.alert('Error', 'Failed to log water');
      }
    }
  };

  const totalCaloriesBurned = loggedExercises.reduce((sum, ex) => sum + ex.cal, 0);

  const getDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -15; i <= 15; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dates = getDates();

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const formatDateParam = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const fetchData = useCallback(async (date?: Date) => {
    if (!user?.token) return;
    const targetDate = date || selectedDate;
    const dateStr = formatDateParam(targetDate);
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      const [summaryRes, mealsRes, waterRes, exerciseRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/meals/today-summary?date=${dateStr}`, { headers }),
        axios.get(`${BACKEND_URL}/api/meals?date=${dateStr}`, { headers }),
        axios.get(`${BACKEND_URL}/api/activities/water?date=${dateStr}`, { headers }),
        axios.get(`${BACKEND_URL}/api/activities/exercises?date=${dateStr}`, { headers }),
      ]);
      setSummary(summaryRes.data);

      const allItems: TimelineItem[] = [
        ...mealsRes.data.meals.map((m: any) => ({ ...m, type: 'meal' })),
        ...waterRes.data,
        ...exerciseRes.data,
      ].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

      setTimelineItems(allItems);

      const dayWater = waterRes.data.reduce((sum: number, w: any) => sum + w.amount_ml, 0);
      setTotalWater(dayWater);

      const dayExercises = exerciseRes.data.map((e: any) => ({ name: e.exercise_name, cal: e.calories_burned }));
      setLoggedExercises(dayExercises);

    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, selectedDate]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  useEffect(() => {
    if (!isSavingAuto) {
      fetchData();
    }
  }, [isSavingAuto, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const selectDate = (d: Date) => {
    setSelectedDate(d);
    setLoading(true);
    fetchData(d);
  };

  const handleDeleteMeal = async (mealId: string, mealName?: string) => {
    if (!user?.token) return;
    Alert.alert(
      'Delete Meal',
      `Are you sure you want to delete ${mealName || 'this meal'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(mealId);
            try {
              await axios.delete(`${BACKEND_URL}/api/meals/${mealId}`, {
                headers: { Authorization: `Bearer ${user.token}` }
              });
              setTimelineItems(prev => prev.filter(m => m.id !== mealId));
              setSwipedMeal(null);
              fetchData();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete meal');
            } finally {
              setDeleting(null);
            }
          }
        },
      ]
    );
  };

  const handleDeleteWater = async (waterId: string, amountMl?: number) => {
    if (!user?.token) return;
    const isGroup = waterId === 'water-group';
    const count = isGroup ? (timelineItems.filter(i => i.type === 'water').length) : 1;

    Alert.alert(
      'Delete Water',
      isGroup
        ? `Are you sure you want to delete all ${count} water logs?`
        : `Are you sure you want to delete ${amountMl} ml water?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(waterId);
            try {
              if (isGroup) {
                const waterEntries = timelineItems.filter(i => i.type === 'water');
                await Promise.all(waterEntries.map(w =>
                  axios.delete(`${BACKEND_URL}/api/activities/water/${w.id}`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                  })
                ));
              } else {
                await axios.delete(`${BACKEND_URL}/api/activities/water/${waterId}`, {
                  headers: { Authorization: `Bearer ${user.token}` }
                });
              }
              setTimelineItems(prev => prev.filter(m => m.type !== 'water'));
              setSwipedMeal(null);
              fetchData();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete water log');
            } finally {
              setDeleting(null);
            }
          }
        },
      ]
    );
  };

  const handleDeleteExercise = async (exerciseId: string, exerciseName?: string, duration?: number) => {
    if (!user?.token) return;
    const isGroup = exerciseId === 'exercise-group';
    const count = isGroup ? (timelineItems.filter(i => i.type === 'exercise').length) : 1;

    Alert.alert(
      'Delete Exercise',
      isGroup
        ? `Are you sure you want to delete all ${count} exercises?`
        : `Are you sure you want to delete ${exerciseName} (${duration} min)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(exerciseId);
            try {
              if (isGroup) {
                const exerciseEntries = timelineItems.filter(i => i.type === 'exercise');
                await Promise.all(exerciseEntries.map(ex =>
                  axios.delete(`${BACKEND_URL}/api/activities/exercises/${ex.id}`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                  })
                ));
              } else {
                await axios.delete(`${BACKEND_URL}/api/activities/exercises/${exerciseId}`, {
                  headers: { Authorization: `Bearer ${user.token}` }
                });
              }
              setTimelineItems(prev => prev.filter(m => m.type !== 'exercise'));
              setSwipedMeal(null);
              fetchData();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete exercise');
            } finally {
              setDeleting(null);
            }
          }
        },
      ]
    );
  };

  const handleUpdateMeal = async () => {
    if (!selectedMealItem || !user?.token) return;
    setUpdating(true);
    try {
      const ratio = editQuantity / (selectedMealItem.quantity_grams || 100);
      await axios.put(`${BACKEND_URL}/api/meals/${selectedMealItem.id}`, {
        food_name: selectedMealItem.food_name,
        quantity_grams: editQuantity,
        calories: Math.round(editBaseCal * ratio),
        protein: Math.round(editBasePro * ratio),
        carbs: Math.round(editBaseCarbs * ratio),
        fats: Math.round(editBaseFats * ratio),
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      setMealDetailModalVisible(false);
      setMealEdited(false);
      fetchData();
      Alert.alert('Success', 'Meal updated successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to update meal');
    } finally {
      setUpdating(false);
    }
  };

  const handleSwipeDelete = (itemId: string, itemType: string, item?: any) => {
    if (itemType === 'meal') {
      handleDeleteMeal(itemId, item?.food_name);
    } else if (itemType === 'water') {
      handleDeleteWater(itemId, item?.amount_ml);
    } else if (itemType === 'exercise') {
      handleDeleteExercise(itemId, item?.exercise_name, item?.duration_minutes);
    }
  };

  const renderRightActions = (_progress: SharedValue<number>, _drag: SharedValue<number>, itemId: string, itemType: string, triggerDelete: () => void) => {
    return (
      <View style={styles.deleteAction}>
        <TouchableOpacity
          style={styles.deleteActionInner}
          onPress={triggerDelete}
        >
          <Ionicons name="trash" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  const caloriesLeft = Math.max((summary?.goal_calories || 2000) - (summary?.total_calories || 0), 0);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const consolidateItems = (items: TimelineItem[]) => {
    const meals = items.filter(i => i.type === 'meal');
    const waters = items.filter(i => i.type === 'water');
    const exercises = items.filter(i => i.type === 'exercise');

    const consolidated: TimelineItem[] = [...meals];

    if (waters.length > 0) {
      const latestWater = waters[0];
      consolidated.push({
        ...latestWater,
        id: 'water-group',
        logged_at: latestWater.logged_at,
        amount_ml: waters.reduce((sum, w) => sum + (w.amount_ml || 0), 0),
        _waterCount: waters.length,
        _waterEntries: waters,
      } as any);
    }

    if (exercises.length > 0) {
      const latestExercise = exercises[0];
      consolidated.push({
        ...latestExercise,
        id: 'exercise-group',
        logged_at: latestExercise.logged_at,
        _exerciseCount: exercises.length,
        _exerciseEntries: exercises,
      } as any);
    }

    return consolidated.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  };

  const displayItems = consolidateItems(timelineItems);

  const isToday = isSameDay(selectedDate, new Date());

  if (loading && !summary) {
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
      {/* STICKY HEADER */}
      <View style={styles.stickyHeader}>
        <View style={styles.header}>
          <Text style={styles.logo}>🍎 Cal AI</Text>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {summary?.meal_count || 0}</Text>
          </View>
        </View>

        {/* Scrollable date strip */}
        <ScrollView
          ref={dateScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateStrip}
          contentContainerStyle={styles.dateStripContent}
          contentOffset={{ x: 15 * 56 - 100, y: 0 }}
        >
          {dates.map((d, i) => {
            const isSelected = isSameDay(d, selectedDate);
            const isTodayDate = isSameDay(d, new Date());
            return (
              <TouchableOpacity
                key={i}
                testID={`date-${formatDateParam(d)}`}
                style={[styles.dayItem, isSelected && styles.dayItemActive]}
                onPress={() => selectDate(d)}
              >
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>{dayLabels[d.getDay()]}</Text>
                <Text style={[styles.dayDate, isSelected && styles.dayDateActive]}>{d.getDate()}</Text>
                {isTodayDate && !isSelected && <View style={styles.todayDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        testID="home-screen"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandPrimary} />}
      >

        {/* DASHBOARD PAGER */}
        <View style={styles.dashboardContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dashboardPagerContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* PAGE 1: Calories & Macros */}
            <View style={styles.dashboardPage}>
              <TouchableOpacity activeOpacity={0.9} onPress={toggleShowEaten} style={styles.caloriePageContainer}>
                <View style={styles.calorieCard}>
                  <View style={styles.calorieInfo}>
                    <Animated.Text style={[
                      styles.calorieNumber,
                      {
                        opacity: calorieOpacity,
                        transform: [{ scale: calorieScale }],
                      },
                    ]}>
                      {showEaten ? (summary?.total_calories || 0) : caloriesLeft.toLocaleString()}
                      {showEaten && (
                        <Text style={styles.calorieGoalText}> / {summary?.goal_calories || 2000}</Text>
                      )}
                    </Animated.Text>

                    <Animated.Text style={[styles.calorieLabel, { opacity: calorieOpacity }]}>
                      {showEaten ? 'Calories eaten' : 'Calories left'}
                    </Animated.Text>
                  </View>
                  <CalorieRing consumed={summary?.total_calories || 0} goal={summary?.goal_calories || 2000} />
                </View>

                <View style={styles.macroRow}>
                  <MacroRing value={summary?.total_protein || 0} goal={summary?.goal_protein || 150} label="Protein" color={Colors.protein} showEaten={showEaten} />
                  <MacroRing value={summary?.total_carbs || 0} goal={summary?.goal_carbs || 250} label="Carbs" color={Colors.carbs} showEaten={showEaten} />
                  <MacroRing value={summary?.total_fats || 0} goal={summary?.goal_fats || 65} label="Fat" color={Colors.fats} showEaten={showEaten} />
                </View>
              </TouchableOpacity>
            </View>

            {/* PAGE 2: Activity & Water */}
            <View style={styles.dashboardPage}>
              <View style={styles.activityRow}>
                {/* Health Connect */}
                <View style={[styles.activityCard, { flex: 1, marginRight: 8, alignItems: 'center', justifyContent: 'center' }]}>
                  {healthConnected ? (
                    <>
                      <View style={[styles.heartIconWrapper, { backgroundColor: Colors.brandPrimary + '20' }]}>
                        <Ionicons name="walk" size={32} color={Colors.brandPrimary} />
                      </View>
                      <Text style={styles.activityCardTitle}>{steps.toLocaleString()}</Text>
                      <Text style={styles.activityCardSub}>Steps Today</Text>
                      <TouchableOpacity style={[styles.connectButton, { backgroundColor: Colors.surfaceElevated }]} onPress={async () => {
                        try {
                          const newSteps = await getTodaySteps();
                          setSteps(newSteps);
                        } catch (e) {
                          console.log('Health not connected');
                        }
                      }}>
                        <Text style={[styles.connectButtonText, { color: Colors.textPrimary }]}>Refresh</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.heartIconWrapper}>
                        <Ionicons name="heart" size={32} color={Colors.error} />
                      </View>
                      <Text style={styles.activityCardTitle}>{Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}</Text>
                      <Text style={styles.activityCardSub}>Track your steps</Text>
                      <TouchableOpacity style={styles.connectButton} onPress={handleConnectHealth}>
                        <Text style={styles.connectButtonText}>Connect</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Calories Burned */}
                <View style={[styles.activityCard, { flex: 1, marginLeft: 8 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.activityCardSub}>Calories burned</Text>
                    <TouchableOpacity onPress={() => setExerciseModalVisible(true)}>
                      <Ionicons name="add-circle" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                    <Text style={styles.calorieBurnedNumber}>{totalCaloriesBurned}</Text>
                    <Text style={styles.calorieBurnedUnit}>cal</Text>
                  </View>

                  <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
                    {loggedExercises.map((ex, idx) => (
                      <View key={idx} style={styles.activityItem}>
                        <Ionicons name="fitness" size={16} color={Colors.textPrimary} style={{ width: 20 }} />
                        <View>
                          <Text style={styles.activityItemName}>{ex.name}</Text>
                          <Text style={styles.activityItemValue}>{ex.cal} cal</Text>
                        </View>
                      </View>
                    ))}
                    {loggedExercises.length === 0 && (
                      <Text style={[styles.activityItemValue, { marginTop: 10, textAlign: 'center' }]}>No exercises yet</Text>
                    )}
                  </ScrollView>
                </View>
              </View>

              {/* Water Card */}
              <View style={styles.waterCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>💧</Text>
                  <View>
                    <Text style={styles.activityCardSub}>Water</Text>
                    <Text style={styles.waterNumber}>{totalWater} ml</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.logWaterButton} onPress={() => setWaterModalVisible(true)}>
                  <Text style={styles.logWaterButtonText}>Log Water</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          {/* Pager Dots */}
          <View style={styles.pagerDots}>
            <View style={[styles.dot, activePage === 0 && styles.dotActive]} />
            <View style={[styles.dot, activePage === 1 && styles.dotActive]} />
          </View>
        </View>

        {/* Recently logged */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isToday ? 'Recently logged' : `Logged on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
          </Text>
          {timelineItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={40} color={Colors.textDisabled} />
              <Text style={styles.emptyText}>Nothing logged yet</Text>
              {isToday && <Text style={styles.emptySubtext}>Tap the upload button to scan your first meal</Text>}
            </View>
          ) : (
            displayItems.map((item) => {
              const handleCardPress = () => {
                if (item.type === 'meal') {
                  setSelectedMealItem(item);
                  setEditQuantity(item.quantity_grams || 100);
                  setEditBaseCal(item.calories || 0);
                  setEditBasePro(item.protein || 0);
                  setEditBaseCarbs(item.carbs || 0);
                  setEditBaseFats(item.fats || 0);
                  setMealEdited(false);
                  setMealDetailModalVisible(true);
                  // GET /api/meals list omits image_base64 for payload size;
                  // fetch the photo lazily for this detail view only.
                  if (user?.token) {
                    axios
                      .get(`${BACKEND_URL}/api/meals/${item.id}`, {
                        headers: { Authorization: `Bearer ${user.token}` },
                      })
                      .then((res) => {
                        setSelectedMealItem((prev) =>
                          prev && prev.id === item.id ? { ...prev, image_base64: res.data.image_base64 } : prev
                        );
                      })
                      .catch(() => {});
                  }
                } else if (item.type === 'water') {
                  setSelectedMealItem(item);
                  setWaterDetailModalVisible(true);
                } else if (item.type === 'exercise') {
                  setSelectedMealItem(item);
                  setExerciseDetailModalVisible(true);
                }
              };

              return (
                <SwipeableTimelineItem
                  key={`${item.type}-${item.id}`}

                  item={item}
                  renderRightActions={renderRightActions}
                  handleSwipeDelete={handleSwipeDelete}
                >
                  <TouchableOpacity
                    testID={`timeline-card-${item.id}`}
                    style={[styles.mealCard, { marginBottom: 12 }]}
                    onPress={handleCardPress}
                    activeOpacity={0.7}
                  >
                    {/* ICON/IMAGE */}
                    {item.type === 'meal' ? (
                      item.image_base64 && item.image_base64.length > 50 ? (
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }}
                          style={styles.mealImage}
                        />
                      ) : (
                        <View style={styles.mealIconPlaceholder}>
                          <Ionicons name="restaurant" size={24} color={Colors.brandPrimary} />
                        </View>
                      )
                    ) : item.type === 'water' ? (
                      <View style={[styles.waterIconPlaceholder, (item as any)._waterCount > 1 && styles.consolidatedIcon]}>
                        <Ionicons name="water" size={24} color="#3498db" />
                        {(item as any)._waterCount > 1 && (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>×{(item as any)._waterCount}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[styles.exerciseIconPlaceholder, (item as any)._exerciseCount > 1 && styles.consolidatedIcon]}>
                        <Ionicons name="fitness" size={24} color="#e67e22" />
                        {(item as any)._exerciseCount > 1 && (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>×{(item as any)._exerciseCount}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* INFO SECTION */}
                    <View style={styles.mealInfo}>
                      <View style={styles.mealHeader}>
                        <Text style={styles.mealName} numberOfLines={1}>
                          {item.type === 'meal' ? item.food_name : item.type === 'water' ? 'Water' : item.exercise_name}
                        </Text>
                        <Text style={styles.mealTime}>{item.type === 'water' && (item as any)._waterCount > 1 ? 'Recent' : item.type === 'exercise' && (item as any)._exerciseCount > 1 ? 'Recent' : formatTime(item.logged_at)}</Text>
                      </View>
                      <View style={styles.mealMacros}>
                        {item.type === 'meal' && (
                          <>
                            <Text style={styles.mealCalories}>🔥 {item.calories} kcal</Text>
                            <Text style={[styles.macroTag, { color: Colors.protein }]}>⚡ {item.protein}g</Text>
                            <Text style={[styles.macroTag, { color: Colors.carbs }]}>🌾 {item.carbs}g</Text>
                            <Text style={[styles.macroTag, { color: Colors.fats }]}>💧 {item.fats}g</Text>
                          </>
                        )}
                        {item.type === 'water' && (
                          <Text style={styles.waterAmountText}>{item.amount_ml} ml consumed{(item as any)._waterCount > 1 ? ` (${(item as any)._waterCount} logs)` : ''}</Text>
                        )}
                        {item.type === 'exercise' && (
                          <Text style={styles.exerciseBurnText}>🔥 {item.calories_burned} kcal burned ({item.duration_minutes} min){(item as any)._exerciseCount > 1 ? ` (${(item as any)._exerciseCount} logs)` : ''}</Text>
                        )}
                      </View>
                    </View>
                    {item.type === 'meal' && (
                      <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
                    )}
                    {item.type === 'water' && (
                      <TouchableOpacity onPress={() => setWaterDetailModalVisible(true)}>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
                      </TouchableOpacity>
                    )}
                    {item.type === 'exercise' && (
                      <TouchableOpacity onPress={() => setExerciseDetailModalVisible(true)}>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </SwipeableTimelineItem>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Water Logging Modal */}
      <Modal visible={waterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Water</Text>
              <TouchableOpacity onPress={() => setWaterModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.durationSelector}>
              <Text style={styles.selectedExerciseName}>Amount</Text>

              <View style={styles.timeControls}>
                <TouchableOpacity
                  style={styles.timeBtn}
                  onPress={() => setWaterAmount(Math.max(50, waterAmount - 50))}
                >
                  <Ionicons name="remove" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.timeText}>{waterAmount} ml</Text>
                <TouchableOpacity
                  style={styles.timeBtn}
                  onPress={() => setWaterAmount(waterAmount + 50)}
                >
                  <Ionicons name="add" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.waterCalculation}>
                <View style={styles.waterCalcRow}>
                  <Text style={styles.waterCalcText}>
                    {totalWater} <Text style={styles.waterCalcPlus}>+</Text> {waterAmount} <Text style={styles.waterCalcEquals}>=</Text> {totalWater + waterAmount} ml
                  </Text>
                  <TouchableOpacity onPress={() => {
                    Alert.alert(
                      'Water Intake Details',
                      `Already consumed: ${totalWater} ml\n\nCurrently adding: ${waterAmount} ml\n\nTotal consumption today: ${totalWater + waterAmount} ml`,
                      [{ text: 'OK', onPress: () => { } }]
                    );
                  }}>
                    <Ionicons name="information-circle" size={20} color={Colors.brandPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.saveExerciseBtn} onPress={handleAddWater}>
                <Text style={styles.saveExerciseBtnText}>Log {waterAmount} ml Water</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Exercise Logging Modal */}
      <Modal visible={exerciseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedExercise ? 'Duration' : 'Select Exercise'}</Text>
              <TouchableOpacity onPress={() => { setExerciseModalVisible(false); setSelectedExercise(null); }}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {!selectedExercise ? (
              <FlatList
                data={EXERCISES}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.exerciseItem} onPress={() => setSelectedExercise(item)}>
                    <Text style={styles.exerciseItemName}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textDisabled} />
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 300 }}
              />
            ) : (
              <View style={styles.durationSelector}>
                <Text style={styles.selectedExerciseName}>{selectedExercise.name}</Text>

                <View style={styles.timeControls}>
                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() => setExerciseDuration(Math.max(5, exerciseDuration - 5))}
                  >
                    <Ionicons name="remove" size={24} color={Colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.timeText}>{exerciseDuration} min</Text>
                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() => setExerciseDuration(exerciseDuration + 5)}
                  >
                    <Ionicons name="add" size={24} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.burnEstimate}>
                  <Text style={styles.burnEstimateText}>
                    🔥 Burn: {selectedExercise.calPerMin * exerciseDuration} kcal
                  </Text>
                </View>

                <TouchableOpacity style={styles.saveExerciseBtn} onPress={handleAddExercise}>
                  <Text style={styles.saveExerciseBtnText}>Log Exercise</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Meal Detail Modal */}
      <Modal visible={mealDetailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meal Details</Text>
              <TouchableOpacity onPress={() => setMealDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedMealItem && (
              <ScrollView style={{ maxHeight: 450 }}>
                {selectedMealItem.image_base64 && selectedMealItem.image_base64.length > 50 && (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${selectedMealItem.image_base64}` }}
                    style={styles.detailMealImage}
                  />
                )}

                {/* Time */}
                <View style={styles.detailTimeRow}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.detailTimeText}>Scanned {formatTime(selectedMealItem.logged_at)}</Text>
                </View>

                {/* Food name */}
                <Text style={styles.detailMealName}>{selectedMealItem.food_name}</Text>

                {/* Meal type badge */}
                <View style={styles.detailTypeBadge}>
                  <Text style={styles.detailTypeText}>{selectedMealItem.meal_type?.charAt(0).toUpperCase()}{selectedMealItem.meal_type?.slice(1)}</Text>
                </View>

                {/* Description */}
                {selectedMealItem.meal_description && (
                  <Text style={styles.detailDescription}>{selectedMealItem.meal_description}</Text>
                )}

                {/* Quantity adjuster */}
                <View style={styles.detailQuantityCard}>
                  <Text style={styles.detailQuantityLabel}>Quantity</Text>
                  <View style={styles.detailQuantityRow}>
                    <TouchableOpacity style={styles.detailQtyBtn} onPress={() => { setEditQuantity(Math.max(10, editQuantity - 10)); setMealEdited(true); }}>
                      <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.detailQtyInput}>{editQuantity}</Text>
                    <Text style={styles.detailQtyUnit}>g</Text>
                    <TouchableOpacity style={styles.detailQtyBtn} onPress={() => { setEditQuantity(editQuantity + 10); setMealEdited(true); }}>
                      <Ionicons name="add" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Calories */}
                <View style={styles.detailCalorieCard}>
                  <Text style={styles.detailCalLabel}>Calories</Text>
                  <Text style={styles.detailCalValue}>{Math.round(editBaseCal * (editQuantity / (selectedMealItem.quantity_grams || 100)))}</Text>
                </View>

                {/* Macros */}
                <View style={styles.detailMacroRow}>
                  <View style={[styles.detailMacroCard, { borderTopColor: Colors.protein }]}>
                    <Text style={styles.detailMacroLabel}>Protein</Text>
                    <Text style={styles.detailMacroValue}>{Math.round(editBasePro * (editQuantity / (selectedMealItem.quantity_grams || 100)))}g</Text>
                  </View>
                  <View style={[styles.detailMacroCard, { borderTopColor: Colors.carbs }]}>
                    <Text style={styles.detailMacroLabel}>Carbs</Text>
                    <Text style={styles.detailMacroValue}>{Math.round(editBaseCarbs * (editQuantity / (selectedMealItem.quantity_grams || 100)))}g</Text>
                  </View>
                  <View style={[styles.detailMacroCard, { borderTopColor: Colors.fats }]}>
                    <Text style={styles.detailMacroLabel}>Fats</Text>
                    <Text style={styles.detailMacroValue}>{Math.round(editBaseFats * (editQuantity / (selectedMealItem.quantity_grams || 100)))}g</Text>
                  </View>
                </View>

                {/* Health score */}
                {selectedMealItem.health_score !== undefined && (
                  <View style={styles.detailHealthCard}>
                    <Text style={styles.detailHealthLabel}>Health Score</Text>
                    <View style={styles.detailHealthBar}>
                      <View style={[styles.detailHealthFill, { width: `${(selectedMealItem.health_score / 10) * 100}%` }]} />
                    </View>
                    <Text style={styles.detailHealthValue}>{selectedMealItem.health_score}/10</Text>
                  </View>
                )}

                {/* Ingredients */}
                {selectedMealItem.ingredients && selectedMealItem.ingredients.length > 0 && (
                  <View style={styles.detailIngredientsSection}>
                    <Text style={styles.detailIngredientsTitle}>Ingredients</Text>
                    <View style={styles.detailTagRow}>
                      {selectedMealItem.ingredients.map((ing, i) => (
                        <View key={i} style={styles.detailTag}>
                          <Text style={styles.detailTagText}>{ing}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Save button (if edited) */}
                <TouchableOpacity
                  style={[styles.saveExerciseBtn, { marginTop: 20 }, !mealEdited && { opacity: 0.5 }]}
                  onPress={handleUpdateMeal}
                  disabled={updating || !mealEdited}
                >
                  {updating ? <ActivityIndicator color="#000" /> : <Text style={styles.saveExerciseBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Water Detail Modal */}
      <Modal visible={waterDetailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Water Logs</Text>
              <TouchableOpacity onPress={() => setWaterDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {(timelineItems.filter(i => i.type === 'water') as any[]).map((water, idx) => (
                <View key={idx} style={styles.detailItem}>
                  <View style={styles.waterIconPlaceholder}>
                    <Ionicons name="water" size={20} color="#3498db" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailItemTitle}>{water.amount_ml} ml</Text>
                    <Text style={styles.detailItemTime}>{formatTime(water.logged_at)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteLogButton}
                    onPress={() => {
                      Alert.alert(
                        'Delete Water',
                        `Delete ${water.amount_ml} ml logged at ${formatTime(water.logged_at)}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              setWaterDetailModalVisible(false);
                              setDeleting(water.id);
                              try {
                                await axios.delete(`${BACKEND_URL}/api/activities/water/${water.id}`, {
                                  headers: { Authorization: `Bearer ${user?.token}` }
                                });
                                setTimelineItems(prev => prev.filter(m => m.id !== water.id));
                                fetchData();
                              } catch (e) {
                                Alert.alert('Error', 'Failed to delete water log');
                              } finally {
                                setDeleting(null);
                              }
                            }
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Exercise Detail Modal */}
      <Modal visible={exerciseDetailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Exercise Logs</Text>
              <TouchableOpacity onPress={() => setExerciseDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {(timelineItems.filter(i => i.type === 'exercise') as any[]).map((exercise, idx) => (
                <View key={idx} style={styles.detailItem}>
                  <View style={styles.exerciseIconPlaceholder}>
                    <Ionicons name="fitness" size={20} color="#e67e22" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailItemTitle}>{exercise.exercise_name}</Text>
                    <Text style={styles.detailItemTime}>{exercise.duration_minutes} min • {exercise.calories_burned} kcal • {formatTime(exercise.logged_at)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteLogButton}
                    onPress={() => {
                      Alert.alert(
                        'Delete Exercise',
                        `Delete ${exercise.exercise_name} (${exercise.duration_minutes} min)?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              setExerciseDetailModalVisible(false);
                              setDeleting(exercise.id);
                              try {
                                await axios.delete(`${BACKEND_URL}/api/activities/exercises/${exercise.id}`, {
                                  headers: { Authorization: `Bearer ${user?.token}` }
                                });
                                setTimelineItems(prev => prev.filter(m => m.id !== exercise.id));
                                fetchData();
                              } catch (e) {
                                Alert.alert('Error', 'Failed to delete exercise');
                              } finally {
                                setDeleting(null);
                              }
                            }
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stickyHeader: { paddingHorizontal: 20, paddingBottom: 8, backgroundColor: Colors.background, zIndex: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 10 },
  logo: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  streakBadge: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  streakText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  dateStrip: { marginBottom: 12, marginHorizontal: -20 },
  dateStripContent: { paddingHorizontal: 16, gap: 6 },
  dayItem: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: Colors.surface, width: 50 },
  dayItemActive: { backgroundColor: Colors.textPrimary },
  dayLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  dayLabelActive: { color: Colors.background },
  dayDate: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  dayDateActive: { color: Colors.background },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.brandPrimary, marginTop: 3 },
  dashboardContainer: { marginHorizontal: -20 },
  dashboardPagerContent: {},
  dashboardPage: { width: SCREEN_WIDTH, paddingHorizontal: 20 },
  calorieCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  caloriePageContainer: { height: 140 },
  calorieInfo: {},
  calorieNumber: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  calorieEatenContainer: { flexDirection: 'row', alignItems: 'baseline' },
  calorieGoalText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginLeft: 2, },
  calorieLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100, },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, height: 180 },
  activityCard: { backgroundColor: Colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border, justifyContent: 'space-between' },
  heartIconWrapper: { width: 60, height: 60, borderRadius: 16, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  activityCardTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', color: Colors.textPrimary },
  activityCardSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  connectButton: { backgroundColor: Colors.textPrimary, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20, marginTop: 10, width: '100%', alignItems: 'center' },
  connectButtonText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  calorieBurnedNumber: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  calorieBurnedUnit: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginLeft: 4 },
  activityItem: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  activityItemName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  activityItemValue: { fontSize: 12, color: Colors.textSecondary },
  waterCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border },
  waterNumber: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  logWaterButton: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  logWaterButtonText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  pagerDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, marginBottom: 20, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.textPrimary, width: 6 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12, letterSpacing: -0.5 },
  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  emptyText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { color: Colors.textDisabled, fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  mealCardWrapper: { marginBottom: 10, position: 'relative' },
  mealCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 18, padding: 10, alignItems: 'center', },
  mealCardSwiped: { backgroundColor: Colors.surface, opacity: 0.5, borderRadius: 18, padding: 10, alignItems: 'center', },
  deleteButton: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: Colors.error, borderTopRightRadius: 18, borderBottomRightRadius: 18, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  deleteButtonContainer: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, justifyContent: 'center', alignItems: 'center' },
  deleteButtonInner: { width: '100%', height: '100%', backgroundColor: Colors.error, borderTopRightRadius: 18, borderBottomRightRadius: 18, justifyContent: 'center', alignItems: 'center' },
  mealImage: { width: 56, height: 56, borderRadius: 14, marginRight: 12 },
  mealIconPlaceholder: { width: 56, height: 56, borderRadius: 14, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  mealInfo: { flex: 1 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  mealName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  mealTime: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  mealMacros: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mealCalories: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  macroTag: { fontSize: 11, fontWeight: '600' },
  waterIconPlaceholder: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#ebf5fb', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  exerciseIconPlaceholder: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#fef5e7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  waterAmountText: { fontSize: 12, fontWeight: '700', color: '#3498db' },
  exerciseBurnText: { fontSize: 12, fontWeight: '700', color: '#e67e22' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  exerciseItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  exerciseItemName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  durationSelector: { alignItems: 'center', paddingVertical: 20 },
  selectedExerciseName: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  timeControls: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
  timeBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  timeText: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  burnEstimate: { marginBottom: 24, padding: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 12 },
  burnEstimateText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  saveExerciseBtn: { backgroundColor: Colors.brandPrimary, width: '100%', padding: 16, borderRadius: 24, alignItems: 'center' },
  saveExerciseBtnText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  waterCalculation: { marginBottom: 24, padding: 16, backgroundColor: Colors.surfaceElevated, borderRadius: 12, alignItems: 'center' },
  waterCalcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  waterCalcText: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  waterCalcPlus: { color: Colors.textSecondary, marginHorizontal: 4 },
  waterCalcEquals: { color: Colors.textSecondary, marginHorizontal: 4, fontWeight: '700' },
  consolidatedIcon: { position: 'relative' },
  countBadge: { position: 'absolute', top: -4, left: -4, backgroundColor: Colors.brandPrimary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countBadgeText: { color: Colors.background, fontSize: 11, fontWeight: '800' },
  detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  deleteLogButton: { padding: 8 },
  detailItemTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  detailItemTime: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  detailMealImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 12 },
  detailTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  detailTimeText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  detailMealName: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  detailTypeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceElevated, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  detailTypeText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  detailDescription: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  detailQuantityCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  detailQuantityLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', marginBottom: 8 },
  detailQuantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  detailQtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  detailQtyInput: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', width: 60 },
  detailQtyUnit: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  detailCalorieCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailCalLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  detailCalValue: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  detailMacroRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  detailMacroCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 3, alignItems: 'center' },
  detailMacroLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  detailMacroValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  detailHealthCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  detailHealthLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  detailHealthBar: { height: 8, backgroundColor: Colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  detailHealthFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  detailHealthValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right', marginTop: 6 },
  detailIngredientsSection: { marginBottom: 12 },
  detailIngredientsTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  detailTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailTag: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  detailTagText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  deleteAction: { width: 80, justifyContent: 'center', alignItems: 'center', borderTopRightRadius: 18, borderBottomRightRadius: 18, marginBottom: 10 },
  deleteActionInner: { backgroundColor: Colors.error, width: 80, height: '95%', justifyContent: 'center', alignItems: 'center', borderTopRightRadius: 18, borderBottomRightRadius: 18 },
});
