import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import AnimatedPressable, { AnimatedPressableProps } from './AnimatedPressable';

export type MicrophonePreviewState = 'idle' | 'recording-preview';

export interface AnimatedMicrophoneButtonProps extends Omit<AnimatedPressableProps, 'children' | 'style' | 'onPressIn' | 'onPressOut'> {
  /** Visual-only state. No microphone permission or audio capture is performed. */
  state?: MicrophonePreviewState;
  onPress: NonNullable<AnimatedPressableProps['onPress']>;
  accessibilityLabel?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showStatus?: boolean;
}

export function AnimatedMicrophoneButton({
  state = 'idle', onPress, accessibilityLabel, size = 82, style,
  showStatus = true, disabled = false, ...pressableProps
}: AnimatedMicrophoneButtonProps) {
  const buttonSize = Math.max(44, size);
  const isRecordingPreview = state === 'recording-preview';
  const transition = useRef(new Animated.Value(isRecordingPreview ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const colorTransition = Animated.spring(transition, {
      toValue: isRecordingPreview ? 1 : 0,
      tension: 180, friction: 18, useNativeDriver: false,
    });
    colorTransition.start();

    if (isRecordingPreview && !disabled) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]));
      loop.start();
      return () => { colorTransition.stop(); loop.stop(); };
    }

    pulse.stopAnimation();
    pulse.setValue(0);
    return () => colorTransition.stop();
  }, [disabled, isRecordingPreview, pulse, transition]);

  const backgroundColor = transition.interpolate({
    inputRange: [0, 1], outputRange: ['#F4B86E', '#7AD09B'],
  });
  const borderColor = transition.interpolate({
    inputRange: [0, 1], outputRange: ['#5A3C25', '#284A35'],
  });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.24] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={[styles.wrapper, style, { minWidth: buttonSize, minHeight: buttonSize }]}>
      <View style={{ width: buttonSize, height: buttonSize, alignItems: 'center', justifyContent: 'center' }}>
        {isRecordingPreview && !disabled ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2,
                borderColor: '#7AD09B', opacity: haloOpacity,
                transform: [{ scale: haloScale }],
              },
            ]}
          />
        ) : null}
        <AnimatedPressable
          {...pressableProps}
          disabled={disabled}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (
            state === 'recording-preview' ? 'Stop recording preview' : 'Start recording preview'
          )}
          accessibilityHint="Changes the visual microphone preview only. No audio is recorded."
          accessibilityState={{ disabled, selected: isRecordingPreview }}
          pressedScale={0.91}
          style={[
            styles.button,
            {
              width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2,
              backgroundColor, borderColor,
            },
          ]}
        >
          <Ionicons name={state === 'recording-preview' ? 'stop' : 'mic'} size={Math.round(buttonSize * 0.39)} color="#2B180D" />
        </AnimatedPressable>
      </View>
      {showStatus ? (
        <Text style={styles.status}>
          {disabled ? 'Unavailable' : isRecordingPreview ? 'Recording preview' : 'Tap to speak'}
        </Text>
      ) : null}
    </View>
  );
}

export default AnimatedMicrophoneButton;

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', borderWidth: 2 },
  button: {
    alignItems: 'center', justifyContent: 'center', borderWidth: 6,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  status: { color: '#FFF2E2', fontSize: 12, fontWeight: '700', marginTop: 12 },
});
