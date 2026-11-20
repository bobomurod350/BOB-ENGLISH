import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import AnimatedPressable from './AnimatedPressable';

export type AppTab = 'home' | 'practice' | 'learn' | 'progress' | 'profile';

export interface AnimatedTabItemProps {
  tab: AppTab;
  label?: string;
  selected: boolean;
  onPress: (tab: AppTab) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
}

const TAB_CONFIG: Record<AppTab, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  home: { label: 'Home', icon: 'home-outline' },
  practice: { label: 'Practice', icon: 'headset-outline' },
  learn: { label: 'Learn', icon: 'book-outline' },
  progress: { label: 'Progress', icon: 'stats-chart-outline' },
  profile: { label: 'Profile', icon: 'person-outline' },
};

export function AnimatedTabItem({
  tab, label, selected, onPress, accessibilityLabel, disabled = false,
  activeColor = '#F4B86E', inactiveColor = '#967E6A',
}: AnimatedTabItemProps) {
  const config = TAB_CONFIG[tab];
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.spring(selection, {
      toValue: selected ? 1 : 0, tension: 180, friction: 20, useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, selection]);

  const indicatorWidth = selection.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });
  const iconScale = selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const labelOpacity = selection.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const iconBackground = selection.interpolate({
    inputRange: [0, 1], outputRange: ['rgba(244,184,110,0)', 'rgba(244,184,110,0.15)'],
  });

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={() => onPress(tab)}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel ?? label ?? config.label}
      accessibilityState={{ selected, disabled }}
      pressedScale={0.94}
      pressedOpacity={0.86}
      style={styles.touchTarget}
    >
      <View style={[styles.content, disabled && styles.disabled]}>
        <Animated.View style={[
          styles.iconContainer,
          { backgroundColor: iconBackground, transform: [{ scale: iconScale }] },
        ]}>
          <Ionicons name={config.icon} size={21} color={selected ? activeColor : inactiveColor} />
        </Animated.View>
        <Animated.Text style={[
          styles.label,
          { color: selected ? activeColor : inactiveColor, opacity: labelOpacity },
          selected && styles.labelSelected,
        ]}>
          {label ?? config.label}
        </Animated.Text>
        <View style={styles.indicatorTrack}>
          <Animated.View style={[styles.indicator, { width: indicatorWidth, backgroundColor: activeColor }]} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

export const TAB_ITEMS: readonly AppTab[] = ['home', 'practice', 'learn', 'progress', 'profile'];
export default AnimatedTabItem;

const styles = StyleSheet.create({
  touchTarget: { flex: 1, minWidth: 52, minHeight: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  content: { minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2 },
  disabled: { opacity: 0.48 },
  iconContainer: { width: 36, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  labelSelected: { fontWeight: '800' },
  indicatorTrack: { height: 3, minWidth: 28, justifyContent: 'center', alignItems: 'center' },
  indicator: { height: 3, borderRadius: 2 },
});
