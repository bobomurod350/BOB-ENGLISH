import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import AnimatedPressable, { AnimatedPressableProps } from './AnimatedPressable';

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
export type IconButtonTone = 'gold' | 'cream';

export interface AnimatedIconButtonProps extends Omit<AnimatedPressableProps, 'children' | 'style'> {
  name: IoniconName;
  accessibilityLabel: string;
  iconSize?: number;
  tone?: IconButtonTone;
  size?: number;
  backgroundColor?: string;
  iconColor?: string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedIconButton({
  name, accessibilityLabel, iconSize = 22, tone = 'gold', size = 48,
  backgroundColor, iconColor, borderRadius, style, disabled = false, ...pressableProps
}: AnimatedIconButtonProps) {
  const palette = tone === 'gold'
    ? { background: '#3A271A', icon: '#F4B86E' }
    : { background: '#382317', icon: '#FFF2E2' };
  // Keep the actual Pressable bounds accessible even with a compact custom size.
  const touchTargetSize = Math.max(44, size);

  return (
    <AnimatedPressable
      {...pressableProps}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      pressedScale={0.92}
      pressedOpacity={0.84}
      style={[
        styles.button,
        {
          backgroundColor: backgroundColor ?? palette.background,
          borderColor: 'rgba(244,184,110,0.22)',
        },
        style,
        {
          width: touchTargetSize,
          height: touchTargetSize,
          minWidth: 44,
          minHeight: 44,
          borderRadius: borderRadius ?? touchTargetSize / 2,
        },
      ]}
    >
      <Ionicons name={name} size={iconSize} color={disabled ? '#967E6A' : (iconColor ?? palette.icon)} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});

export default AnimatedIconButton;
