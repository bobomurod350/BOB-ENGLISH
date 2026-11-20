import React, { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityState, Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  pressedScale?: number;
  pressedOpacity?: number;
  tension?: number;
  friction?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  accessibilityState?: AccessibilityState;
}

export const AnimatedPressable = forwardRef<React.ElementRef<typeof Pressable>, AnimatedPressableProps>(
  function AnimatedPressable({
    children, disabled = false, pressedScale = 0.97, pressedOpacity = 0.88,
    tension = 260, friction = 18, style, onPressIn, onPressOut,
    accessibilityState, hitSlop, ...pressableProps
  }, forwardedRef) {
    const progress = useRef(new Animated.Value(0)).current;
    const animation = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => () => animation.current?.stop(), []);

    const animateTo = useCallback((value: number) => {
      animation.current?.stop();
      animation.current = Animated.spring(progress, {
        toValue: value, tension, friction, useNativeDriver: true,
      });
      animation.current.start();
    }, [friction, progress, tension]);

    const animatedStyle = useMemo(() => ({
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, pressedOpacity] }),
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, pressedScale] }) }],
    }), [pressedOpacity, pressedScale, progress]);

    const resolveStyle = useCallback(({ pressed }: { pressed: boolean }) => [
      styles.touchTarget,
      typeof style === 'function' ? style({ pressed }) : style,
      animatedStyle,
    ], [animatedStyle, style]);

    const handlePressIn = useCallback((event: GestureResponderEvent) => {
      if (!disabled) animateTo(1);
      onPressIn?.(event);
    }, [animateTo, disabled, onPressIn]);

    const handlePressOut = useCallback((event: GestureResponderEvent) => {
      animateTo(0);
      onPressOut?.(event);
    }, [animateTo, onPressOut]);

    return (
      <Pressable
        {...pressableProps}
        ref={forwardedRef}
        disabled={disabled}
        hitSlop={hitSlop ?? 4}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityState={{ ...accessibilityState, disabled: disabled || accessibilityState?.disabled }}
        style={resolveStyle}
      >
        {children}
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  touchTarget: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
});

export default AnimatedPressable;
