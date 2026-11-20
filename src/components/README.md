# BOB ENGLISH interaction components

Premium espresso / cream / gold interaction primitives using React Native's built-in Animated API.

## AnimatedPressable

```tsx
import AnimatedPressable from './AnimatedPressable';

<AnimatedPressable
  onPress={handlePress}
  accessibilityRole="button"
  accessibilityLabel="Start lesson"
  pressedScale={0.96}
>
  <Text>Start lesson</Text>
</AnimatedPressable>
```

Extends React Native `PressableProps` (except `style`) and adds:
- `pressedScale?: number` — 0.97
- `pressedOpacity?: number` — 0.88
- `tension?: number` — 260
- `friction?: number` — 18
- `style?: StyleProp<ViewStyle> | (({ pressed }) => StyleProp<ViewStyle>)`

Uses spring scale/opacity feedback, defaults `hitSlop` to 4 points, applies a 44×44 minimum target, supports disabled and accessibility state, and forwards normal Pressable props/callbacks.

## AnimatedIconButton

```tsx
import { AnimatedIconButton } from './AnimatedIconButton';

<AnimatedIconButton
  name="bookmark-outline"
  accessibilityLabel="Save vocabulary word"
  tone="gold"
  onPress={saveWord}
/>
```

Props: `name` (Ionicons name), required `accessibilityLabel`, `iconSize?: number` (22), `tone?: 'gold' | 'cream'`, `size?: number` (48), `backgroundColor?`, `iconColor?`, `borderRadius?`, `disabled?`, and standard Pressable props. The interactive target never renders smaller than 44×44 points, even when a smaller `size` is supplied.

## AnimatedTabItem

```tsx
import AnimatedTabItem, { AppTab, TAB_ITEMS } from './AnimatedTabItem';

{TAB_ITEMS.map((tab: AppTab) => (
  <AnimatedTabItem
    key={tab}
    tab={tab}
    selected={activeTab === tab}
    onPress={setActiveTab}
  />
))}
```

Supported tab keys: `home`, `practice`, `learn`, `progress`, `profile`. The icon background, label emphasis, and gold selection indicator animate on selection. Exposes tab role and selected accessibility state.

## AnimatedMicrophoneButton

```tsx
import AnimatedMicrophoneButton, { MicrophonePreviewState } from './AnimatedMicrophoneButton';

const [micState, setMicState] = useState<MicrophonePreviewState>('idle');

<AnimatedMicrophoneButton
  state={micState}
  onPress={() => setMicState(current =>
    current === 'recording-preview' ? 'idle' : 'recording-preview'
  )}
/>
```

States: `idle` and `recording-preview`. Touch feedback is handled by `AnimatedPressable`. The preview state uses a green accent and subtle pulse only. It does not request permission, access the microphone, or record audio.

## Example bottom navigation

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import AnimatedTabItem, { AppTab, TAB_ITEMS } from './AnimatedTabItem';

export function BottomNavigation() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#21140D', paddingVertical: 8 }}>
      {TAB_ITEMS.map(tab => (
        <AnimatedTabItem
          key={tab}
          tab={tab}
          selected={activeTab === tab}
          onPress={setActiveTab}
        />
      ))}
    </View>
  );
}
```

## Implementation notes

- Built-in React Native `Animated` and `Pressable` only.
- Existing `@react-native-vector-icons/ionicons` package only.
- No package, lockfile, Expo config, existing asset, or App.tsx changes.
- Icon buttons provide 48×48 points by default; generic pressable has a 44×44 minimum.
