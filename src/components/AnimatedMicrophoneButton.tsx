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
  // A disabled control is always idle, regardless of its requested preview state.
  const isRecordingPreview = !disabled && state === 'recording-preview';
  const transition = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled) {
      transition.stopAnimation();
      transition.setValue(0);
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const colorTransition = Animated.spring(transition, {
      toValue: isRecordingPreview ? 1 : 0,
      tension: 180, friction: 18, useNativeDriver: false,
    });
    colorTransition.start();

    let pulseLoop: Animated.CompositeAnimation | undefined;
    if (isRecordingPreview) {
      pulseLoop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]));
      pulseLoop.start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }

    return () => {
      colorTransition.stop();
      pulseLoop?.stop();
    };
  }, [disabled, isRecordingPreview, pulse, transition]);

  const backgroundColor = disabled
    ? '#F4B86E'
    : transition.interpolate({ inputRange: [0, 1], outputRange: ['#F4B86E', '#7AD09B'] });
  const borderColor = disabled
    ? '#5A3C25'
    : transition.interpolate({ inputRange: [0, 1], outputRange: ['#5A3C25', '#284A35'] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.24] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={[styles.wrapper, style, { minWidth: buttonSize, minHeight: buttonSize }]}>
      <View style={{ width: buttonSize, height: buttonSize, alignItems: 'center', justifyContent: 'center' }}>
        {isRecordingPreview ? (
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
          accessibilityLabel={disabled
            ? 'Microphone unavailable'
            : accessibilityLabel ?? (isRecordingPreview ? 'Stop microphone preview' : 'Start microphone preview')}
          accessibilityHint={disabled
            ? 'Microphone preview is unavailable while this control is disabled.'
            : 'Changes the visual microphone preview only. No audio is recorded.'}
          accessibilityState={{ disabled, selected: isRecordingPreview }}
          pressedScale={0.91}
          style={{ width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 }}
        >
          <Animated.View
            style={[
              styles.button,
              {
                width: buttonSize,
                height: buttonSize,
                borderRadius: buttonSize / 2,
                backgroundColor,
                borderColor,
              },
            ]}
          >
            <Ionicons name={isRecordingPreview ? 'stop' : 'mic'} size={Math.round(buttonSize * 0.39)} color="#2B180D" />
          </Animated.View>
        </AnimatedPressable>
      </View>
      {showStatus ? (
        <Text style={styles.status}>
          {disabled ? 'Unavailable' : isRecordingPreview ? 'Recording preview' : 'Tap to preview'}
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
