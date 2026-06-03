import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../constants/Colors';

interface MacroRingProps {
  value: number;
  goal: number;
  label: string;
  color: string;
  size?: number;
  strokeWidth?: number;
  showEaten?: boolean;
}

export default function MacroRing({ value, goal, label, color, size = 47, strokeWidth = 6, showEaten = false }: MacroRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / Math.max(goal, 1), 1);
  const strokeDashoffset = circumference - progress * circumference;
  const remaining = Math.max(goal - value, 0);
  const isOver = value > goal;

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevShowEatenRef = useRef(showEaten);

  useEffect(() => {
    if (prevShowEatenRef.current !== showEaten) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.7,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
      prevShowEatenRef.current = showEaten;
    }
  }, [showEaten]);

  const displayValue = showEaten ? value : (isOver ? value - goal : remaining);

  return (
    <View testID={`macro-ring-${label.toLowerCase()}`} style={[styles.container, { width: size + 40 }]}>
      <View style={[styles.ringBg, { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 12 }]}>
        <Animated.View style={[styles.valueContainer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          {showEaten ? (
            <View style={styles.eatenRow}>
              <Text style={[styles.value, { color: Colors.textPrimary }]}>{Math.round(value)}</Text>
              <Text style={[styles.goalText, { color: Colors.textSecondary }]}>/{goal}g</Text>
            </View>
          ) : (
            <Text style={[styles.value, { color: Colors.textPrimary }]}>
              {Math.round(displayValue)}g
            </Text>
          )}
        </Animated.View>
        <Text style={[styles.sublabel, { color: Colors.textSecondary }]}>
          {showEaten ? `${label} eaten` : (isOver ? `${label} over` : `${label} left`)}
        </Text>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={Colors.border}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isOver ? Colors.error : color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', marginRight: 8, marginLeft: 8 },
  ringBg: { alignItems: 'center', minWidth: 100, borderWidth: 1, borderColor: Colors.border },
  valueContainer: { alignItems: 'center' },
  eatenRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  goalText: { fontSize: 14, fontWeight: '600', marginLeft: 2, color: Colors.textSecondary },
  sublabel: { fontSize: 12, marginTop: 2, color: Colors.textSecondary },
});
