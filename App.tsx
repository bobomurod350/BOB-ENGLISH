import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  BackHandler,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView, BlurTargetView } from 'expo-blur';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';

type IconName = string;
type Screen = 'welcome' | 'home' | 'practice' | 'learn' | 'progress' | 'profile' | 'chat' | 'voice' | 'vocabulary' | 'correction' | 'lesson';
type Tab = 'home' | 'practice' | 'learn' | 'progress' | 'profile';
type ChatMessage = { id: number; from: 'emma' | 'you'; text: string; time: string };
type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
type CharacterId = 'emma' | 'spongebob';
type GeminiVoiceName = 'Achernar' | 'Puck';
type VoicePace = 'slow' | 'natural' | 'fast';
type CharacterProfile = {
  id: CharacterId;
  name: string;
  role: string;
  tagline: string;
  voiceName: GeminiVoiceName;
  voiceStyle: string;
  accent: string;
  surface: string;
  screen: string;
  image: React.ComponentProps<typeof Image>['source'];
};
type VoiceSettings = {
  characterId: CharacterId;
  speakingPace: VoicePace;
};

// Emma and SpongeBob are the two currently enabled Gemini Live characters.
const VOICE_CHARACTERS: CharacterProfile[] = [
  {
    id: 'emma',
    name: 'Emma',
    role: 'English tutor',
    tagline: 'Gentle, patient and encouraging',
    voiceName: 'Achernar',
    voiceStyle: 'Soft female',
    accent: '#F4B86E',
    surface: '#302015',
    screen: '#170E09',
    image: require('./assets/emma-cafe.jpg'),
  },
  {
    id: 'spongebob',
    name: 'SpongeBob',
    role: 'English practice buddy',
    tagline: 'Cheerful, playful and encouraging',
    voiceName: 'Puck',
    voiceStyle: 'Upbeat',
    accent: '#F4D34E',
    surface: '#263B43',
    screen: '#101F27',
    image: require('./assets/characters/spongebob.png'),
  },
];

const PACE_OPTIONS: Array<{ value: VoicePace; title: string; description: string }> = [
  { value: 'slow', title: 'Slow', description: 'Clearer, with more pauses' },
  { value: 'natural', title: 'Natural', description: 'Balanced everyday pace' },
  { value: 'fast', title: 'Fast', description: 'A little more energetic' },
];
type GeminiLiveMessage = {
  setupComplete?: Record<string, unknown>;
  serverContent?: {
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  error?: { message?: string };
};

const C = {
  bg: '#170E09',
  bg2: '#21140D',
  card: '#2B1B12',
  card2: '#382317',
  card3: '#442A1C',
  cream: '#FFF2E2',
  white: '#FFFAF4',
  muted: '#C4AE9A',
  dim: '#967E6A',
  line: '#62432F',
  gold: '#F4B86E',
  gold2: '#D98E42',
  green: '#7AD09B',
  red: '#E47763',
};

const EMMA = require('./assets/emma-cafe.jpg');
const API_BASE_URL = 'http://10.125.74.127:8787';
const LIVE_SAMPLE_RATE = 16000;
const LIVE_OUTPUT_SAMPLE_RATE = 24000;

const EMMA_LIVE_PROMPT = `
You are Emma, a friendly, patient female AI English tutor for BOB ENGLISH.

STUDENT LEVEL: A2

YOUR PERSONALITY:
- Warm, natural, encouraging and respectful.
- Speak like a real English teacher, not like a formal robot.
- Use a gentle, soft, warm feminine voice.
- Use natural conversational English.
- Adapt vocabulary and sentence complexity to the student's level.

TEACHING RULES:
- Help the student practise real-life English conversations.
- Correct mistakes gently and clearly.
- When useful, show: "Your sentence" and "More natural English".
- Explain grammar in simple words.
- Give one or two useful examples when appropriate.
- Ask one natural follow-up question to continue the conversation.
- Do not overload the student with long explanations.
- Encourage the student to speak confidently.

LANGUAGE:
- Default language: English.
- Teach and converse in English only.
- Use simple English explanations suitable for an A2 learner.

IMPORTANT:
- Never pretend to be a human.
- Never invent information about the student's progress.
- Keep normal replies concise and friendly.
`;

function resampleMono(samples: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate || samples.length === 0) return samples;

  const outputLength = Math.max(1, Math.round(samples.length * outputRate / inputRate));
  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.min(Math.floor(position), samples.length - 1);
    const right = Math.min(left + 1, samples.length - 1);
    const fraction = position - left;
    output[i] = samples[left] * (1 - fraction) + samples[right] * fraction;
  }

  return output;
}

function encodePcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, pcm, true);
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0;
    const c = hasC ? bytes[i + 2] : 0;

    encoded += alphabet[a >> 2];
    encoded += alphabet[((a & 3) << 4) | (b >> 4)];
    encoded += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : '=';
    encoded += hasC ? alphabet[c & 63] : '=';
  }

  return encoded;
}

/**
 * React Native WebSocket payloads can arrive as strings, Blobs, ArrayBuffers,
 * or already-decoded objects depending on the platform/runtime. Do not call
 * String(data) on Blob/object payloads: it produces values such as
 * '[object Blob]' and causes JSON.parse to fail before setupComplete is read.
 */
async function parseGeminiLiveMessage(data: unknown): Promise<GeminiLiveMessage> {
  let jsonText: string | undefined;

  if (typeof data === 'string') {
    jsonText = data;
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    jsonText = await data.text();
  } else if (data instanceof ArrayBuffer) {
    jsonText = new TextDecoder().decode(new Uint8Array(data));
  } else if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    jsonText = new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
    );
  } else if (data !== null && typeof data === 'object') {
    const objectData = data as Record<string, unknown>;
    const protocolKeys = [
      'setupComplete',
      'serverContent',
      'error',
      'goAway',
      'sessionResumptionUpdate',
      'usageMetadata',
      'toolCall',
      'toolCallCancellation',
    ];

    if (protocolKeys.some(key => Object.prototype.hasOwnProperty.call(objectData, key))) {
      return objectData as GeminiLiveMessage;
    }

    // Some runtimes wrap the received message in an object with a `data` field.
    if (Object.prototype.hasOwnProperty.call(objectData, 'data')) {
      return parseGeminiLiveMessage(objectData.data);
    }

    throw new Error(`Unsupported voice service WebSocket object (${Object.keys(objectData).join(', ') || 'empty'}).`);
  } else {
    throw new Error('The voice service returned an empty or unsupported response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('The voice service returned an invalid response.');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The voice service returned an unexpected response format.');
  }

  return parsed as GeminiLiveMessage;
}

function Icon({ name, size = 20, color = C.cream }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name as never} size={size} color={color} />;
}

function AppButton({ title, onPress, icon, secondary = false, compact = false }: {
  title: string; onPress: () => void; icon?: IconName; secondary?: boolean; compact?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.button,
      secondary && styles.buttonSecondary,
      compact && styles.buttonCompact,
      pressed && styles.pressed,
    ]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, compact && styles.buttonTextCompact]}>{title}</Text>
      {icon ? <Icon name={icon} size={18} color={secondary ? C.gold : '#2B180D'} /> : null}
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? <Pressable onPress={onAction}><Text style={styles.seeAll}>{action}</Text></Pressable> : null}
    </View>
  );
}

function ProgressBar({ progress, color = C.gold }: { progress: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(progress, 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

function AnimatedCount({
  value,
  suffix = '',
  delay = 0,
  duration = 1300,
  style,
}: {
  value: number;
  suffix?: string;
  delay?: number;
  duration?: number;
  style?: React.ComponentProps<typeof Text>['style'];
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animatedValue.stopAnimation();
    animatedValue.setValue(0);
    setDisplayValue(0);

    const listener = animatedValue.addListener(({ value: current }) => {
      setDisplayValue(Math.round(current));
    });

    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) setDisplayValue(value);
    });

    return () => {
      animation.stop();
      animatedValue.removeListener(listener);
    };
  }, [animatedValue, value, delay, duration]);

  return <Text style={style}>{displayValue}{suffix}</Text>;
}

function AnimatedProgressBar({
  progress,
  color = C.gold,
  delay = 0,
}: {
  progress: number;
  color?: string;
  delay?: number;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.stopAnimation();
    animatedValue.setValue(0);

    const animation = Animated.timing(animatedValue, {
      toValue: Math.max(0, Math.min(progress, 100)),
      duration: 1200,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [animatedValue, progress, delay]);

  const width = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          { width, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function AnimatedWeekBar({
  height,
  index,
}: {
  height: number;
  index: number;
}) {
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedHeight.stopAnimation();
    animatedHeight.setValue(0);

    const animation = Animated.timing(animatedHeight, {
      toValue: height * 0.62,
      duration: 1000,
      delay: 400 + index * 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [animatedHeight, height, index]);

  return (
    <Animated.View
      style={[
        styles.weekBar,
        { height: animatedHeight },
      ]}
    />
  );
}

function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.screenHeader}>
      <Pressable onPress={onBack} style={styles.backButton}><Icon name="chevron-back" size={22} /></Pressable>
      <Text style={styles.screenTitle}>{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

function StaggeredItem({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(18);
    scale.setValue(0.97);

    const delay = index * 65;

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 440,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 440,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
  }, [index, opacity, translateY, scale]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        alignSelf: 'stretch',
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function flattenAnimatedChildren(children: React.ReactNode): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  React.Children.forEach(children, child => {
    if (child == null || typeof child === 'boolean') return;

    if (React.isValidElement(child) && child.type === React.Fragment) {
      const fragmentProps = child.props as { children?: React.ReactNode };
      result.push(...flattenAnimatedChildren(fragmentProps.children));
    } else {
      result.push(child);
    }
  });

  return result;
}

type StaggeredScrollViewProps = React.ComponentProps<typeof ScrollView> & {
  animationKey: string;
};

function StaggeredScrollView({
  children,
  animationKey,
  ...scrollViewProps
}: StaggeredScrollViewProps) {
  const items = flattenAnimatedChildren(children);

  return (
    <ScrollView {...scrollViewProps}>
      {items.map((child, index) => (
        <StaggeredItem
          key={`${animationKey}-${index}`}
          index={index}
        >
          {child}
        </StaggeredItem>
      ))}
    </ScrollView>
  );
}

function Avatar({ size = 42 }: { size?: number }) {
  return <Image source={EMMA} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: C.gold }} />;
}

/* GLASS BOTTOM NAVIGATION */

function BottomTabs({
  active,
  onSelect,
  bottomInset = 0,
  blurTarget,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
  bottomInset?: number;
  blurTarget: React.RefObject<React.ComponentRef<typeof View> | null>;
}) {
  const tabs: { key: Tab; title: string; icon: IconName }[] = [
    { key: 'home', title: 'Home', icon: 'home-outline' },
    { key: 'practice', title: 'Practice', icon: 'headset-outline' },
    { key: 'learn', title: 'Learn', icon: 'book-outline' },
    { key: 'progress', title: 'Progress', icon: 'stats-chart-outline' },
    { key: 'profile', title: 'Profile', icon: 'person-outline' },
  ];

  return (
    <View style={[styles.tabBarArea, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <View style={styles.tabBarShell}>
        <BlurView
          pointerEvents="none"
          blurTarget={blurTarget}
          intensity={75}
          tint="dark"
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurReductionFactor={2}
          style={styles.tabBarBlur}
        />

        <View pointerEvents="none" style={styles.tabBarTint} />

        <View style={styles.tabBarRow}>
          {tabs.map((tab) => {
            const selected = active === tab.key;

            return (
              <Pressable
                key={tab.key}
                onPress={() => onSelect(tab.key)}
                accessibilityRole="tab"
                accessibilityLabel={`Navigate to ${tab.title} tab`}
                accessibilityHint={`Switches to the ${tab.title} screen.`}
                accessibilityState={{ selected }}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.tabItem,
                  selected && styles.tabItemActive,
                  pressed && styles.tabItemPressed,
                ]}
              >
                <Icon
                  name={tab.icon}
                  size={20}
                  color={selected ? C.gold : C.dim}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    selected && styles.tabLabelActive,
                  ]}
                >
                  {tab.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function FeatureTile({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.featureTile, pressed && styles.pressed]}>
      <View style={styles.featureIcon}><Icon name={icon} size={23} color={C.gold} /></View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function ScenarioCard({ icon, title, detail, onPress, tint = C.card2 }: { icon: IconName; title: string; detail: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.scenarioCard, { backgroundColor: tint }, pressed && styles.pressed]}>
      <View style={styles.scenarioIcon}><Icon name={icon} size={24} color={C.gold} /></View>
      <View style={styles.scenarioCopy}>
        <Text style={styles.scenarioTitle}>{title}</Text>
        <Text style={styles.scenarioDetail}>{detail}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={C.gold} />
    </Pressable>
  );
}

function WelcomeEntrance({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-45)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(-45);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay: index * 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      Animated.timing(translateX, {
        toValue: 0,
        duration: 580,
        delay: index * 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
  }, [index, opacity, translateX]);

  return (
    <Animated.View
      style={{
        alignSelf: 'stretch',
        opacity,
        transform: [{ translateX }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<React.ComponentRef<typeof View> | null>(null);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compactWidth = windowWidth < 360;
  const shortScreen = windowHeight < 700;

  const [screen, setScreen] = useState<Screen>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const screenRef = useRef<Screen>('welcome');
  const historyRef = useRef<Screen[]>([]);

  const [chatInput, setChatInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [scenario, setScenario] = useState('Café Conversation');
  const [voiceSettingsVisible, setVoiceSettingsVisible] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    characterId: 'emma',
    speakingPace: 'natural',
  });
  const [voiceSettingsDraft, setVoiceSettingsDraft] = useState<VoiceSettings>({
    characterId: 'emma',
    speakingPace: 'natural',
  });
  const selectedCharacter = VOICE_CHARACTERS.find(character => character.id === voiceSettings.characterId) ?? VOICE_CHARACTERS[0];
  const draftCharacter = VOICE_CHARACTERS.find(character => character.id === voiceSettingsDraft.characterId) ?? VOICE_CHARACTERS[0];

  const voiceSocketRef = useRef<WebSocket | null>(null);
  const voiceRecorderRef = useRef<InstanceType<typeof AudioRecorder> | null>(null);
  const voiceAudioContextRef = useRef<InstanceType<typeof AudioContext> | null>(null);
  const voicePlaybackQueueRef = useRef<ReturnType<AudioContext['createBufferQueueSource']> | null>(null);
  const voiceSetupResolveRef = useRef<(() => void) | null>(null);
  const voiceSetupRejectRef = useRef<((error: Error) => void) | null>(null);
  const voiceDecodeChainRef = useRef<Promise<void>>(Promise.resolve());
  const voiceRunIdRef = useRef(0);
  const voiceReplyIdRef = useRef(0);
  const voiceAssistantTextRef = useRef('');
  const voiceSessionReadyRef = useRef(false);
  const voiceStreamingRef = useRef(false);
  const voiceRecorderActiveRef = useRef(false);
  const voiceAudioSessionActiveRef = useRef(false);
  const voicePlaybackStartedQueueRef = useRef<ReturnType<AudioContext['createBufferQueueSource']> | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 1, from: 'emma', text: "Hi! I'm Emma. I work at this café. I really love coffee and meeting new people. So, what do you usually drink at a café?", time: '9:41' },
    { id: 2, from: 'you', text: 'I usually drink coffee with milk.', time: '9:42' },
    { id: 3, from: 'emma', text: "That sounds lovely! I usually make a cappuccino in the morning. Do you prefer hot coffee or iced coffee?", time: '9:42' },
  ]);

  const [savedWords, setSavedWords] = useState<string[]>(['usually', 'prefer']);
  const [learnFilter, setLearnFilter] = useState<'Grammar' | 'Listening' | 'Reading'>('Grammar');

  const navigate = useCallback((next: Screen) => {
    const current = screenRef.current;
    const isDestinationMainTab = (['home', 'practice', 'learn', 'progress', 'profile'] as const).includes(next as Tab);

    if (isDestinationMainTab) {
      setActiveTab(next as Tab);
    }

    if (current === next) return;

    if (isDestinationMainTab) {
      historyRef.current = [];
    } else if (current !== 'welcome') {
      historyRef.current.push(current);
    }

    screenRef.current = next;
    setScreen(next);
    Keyboard.dismiss();
  }, []);

  const goBack = useCallback(() => {
    const previous = historyRef.current.pop();
    const destination = previous || activeTab;

    if ((['home', 'practice', 'learn', 'progress', 'profile'] as const).includes(destination as Tab)) {
      setActiveTab(destination as Tab);
    }

    screenRef.current = destination;
    setScreen(destination);
    Keyboard.dismiss();
    return true;
  }, [activeTab]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const current = screenRef.current;
      if (current === 'welcome') return false;
      if (current === activeTab) return false;
      return goBack();
    });

    return () => subscription.remove();
  }, [activeTab, goBack]);

  const scrollProps = {
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
    contentContainerStyle: [
      styles.scrollContent,
      {
        paddingHorizontal: compactWidth ? 15 : Math.min(24, Math.max(18, windowWidth * 0.05)),
        paddingBottom: 28,
      },
    ],
  };

  const goTab = (tab: Tab) => {
    historyRef.current = [];
    setActiveTab(tab);
    screenRef.current = tab;
    setScreen(tab);
    Keyboard.dismiss();
  };

  const openChat = (nextScenario = 'Free Conversation') => {
    setScenario(nextScenario);
    setChatMessages([{
      id: Date.now(),
      from: 'emma',
      text: nextScenario === 'Café Conversation'
        ? "Hi! I'm Emma. I work at this café. I love meeting new people. What would you like to drink today?"
        : `Hi! I'm Emma. Today we're practising: ${nextScenario.toLowerCase()}. I'll speak first, and you can answer me in English. Ready?`,
      time: 'Now',
    }]);
    navigate('chat');
  };

  const sendMessage = async () => {
    const message = chatInput.trim();

    if (!message || chatSending) return;

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const history = chatMessages.slice(-12).map(item => ({
      role: item.from === 'you' ? 'user' : 'assistant',
      content: item.text,
    }));

    setChatMessages(current => [
      ...current,
      {
        id: Date.now(),
        from: 'you',
        text: message,
        time,
      },
    ]);

    setChatInput('');
    setChatSending(true);
    Keyboard.dismiss();

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history,
          studentLevel: 'A2',
        }),
      });

      const data: { success?: boolean; reply?: string; error?: string } = await response.json();
      const reply = typeof data.reply === 'string' ? data.reply.trim() : '';

      if (!response.ok || data.success !== true || !reply) {
        throw new Error(data.error || `The AI tutor request failed (HTTP ${response.status}).`);
      }

      setChatMessages(current => [
        ...current,
        {
          id: Date.now() + 1,
          from: 'emma',
          text: reply,
          time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
        },
      ]);
    } catch (error) {
      console.error('Emma Chat Error:', error);
      Alert.alert(
        'Connection problem',
        error instanceof Error
          ? error.message
          : 'Emma could not respond. Check the connection and try again.',
      );
    } finally {
      setChatSending(false);
    }
  };

  const stopVoice = async () => {
    voiceRunIdRef.current += 1;
    voiceStreamingRef.current = false;
    voiceSessionReadyRef.current = false;
    voiceReplyIdRef.current += 1;
    voiceAssistantTextRef.current = '';
    setRecording(false);
    setVoiceStatus('idle');

    voiceSetupRejectRef.current?.(new Error('Voice session stopped.'));
    voiceSetupResolveRef.current = null;
    voiceSetupRejectRef.current = null;

    const socket = voiceSocketRef.current;
    voiceSocketRef.current = null;

    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      } catch (error) {
        console.warn('Could not finish Gemini audio stream:', error);
      }
    }

    const recorder = voiceRecorderRef.current;
    voiceRecorderRef.current = null;
    if (recorder) {
      try {
        if (voiceRecorderActiveRef.current) await recorder.stop();
      } catch (error) {
        console.warn('Could not stop microphone:', error);
      }
      voiceRecorderActiveRef.current = false;
      try {
        recorder.clearOnAudioReady();
      } catch (error) {
        console.warn('Could not clear microphone callback:', error);
      }
    }

    if (socket && socket.readyState < WebSocket.CLOSING) {
      try {
        socket.close(1000, 'Voice session ended');
      } catch (error) {
        console.warn('Could not close Gemini connection:', error);
      }
    }

    const queue = voicePlaybackQueueRef.current;
    voicePlaybackQueueRef.current = null;
    voicePlaybackStartedQueueRef.current = null;
    if (queue) {
      try {
        queue.clearBuffers();
        queue.disconnect();
      } catch (error) {
        console.warn('Could not clear audio playback:', error);
      }
    }

    const audioContext = voiceAudioContextRef.current;
    voiceAudioContextRef.current = null;
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (error) {
        console.warn('Could not close audio context:', error);
      }
    }

    if (voiceAudioSessionActiveRef.current) {
      voiceAudioSessionActiveRef.current = false;
      try {
        await AudioManager.setAudioSessionActivity(false);
      } catch (error) {
        console.warn('Could not deactivate audio session:', error);
      }
    }

    voiceDecodeChainRef.current = Promise.resolve();
  };

  const openVoiceSettings = () => {
    setVoiceSettingsDraft(voiceSettings);
    setVoiceSettingsVisible(true);
  };

  const applyVoiceSettings = () => {
    setVoiceSettings(voiceSettingsDraft);
    setVoiceSettingsVisible(false);

    if (voiceStreamingRef.current || voiceStatus === 'connecting') {
      void stopVoice();
      Alert.alert(
        'Character saved',
        `The current conversation has stopped. Tap the microphone to talk with ${draftCharacter.name}.`,
      );
      return;
    }

    Alert.alert(
      'Character saved',
      `${draftCharacter.name} is ready. The next voice session will use this character's voice and personality.`,
    );
  };



  const startVoice = async () => {  const startVoice = async () => {
    if (voiceStatus === 'connecting' || voiceStreamingRef.current) return;

    const runId = voiceRunIdRef.current + 1;
    voiceRunIdRef.current = runId;
    setVoiceStatus('connecting');
    setVoiceTranscript('');

    try {
      const permission = await AudioManager.requestRecordingPermissions();
      if (permission !== 'Granted') {
        throw new Error('Microphone permission is required. Allow microphone access in Android settings.');
      }
      if (runId !== voiceRunIdRef.current) return;

      const tokenResponse = await fetch(`${API_BASE_URL}/api/live-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voiceSettings),
      });
      const tokenData: {
        success?: boolean;
        token?: string;
        model?: string;
        voiceName?: GeminiVoiceName;
        characterId?: CharacterId;
        characterName?: string;
        speechProvider?: 'gemini';
        systemInstruction?: string;
        error?: string;
      } = await tokenResponse.json();

      if (!tokenResponse.ok || tokenData.success !== true || !tokenData.token) {
        throw new Error(tokenData.error || `Could not start ${selectedCharacter.name}’s voice session (HTTP ${tokenResponse.status}).`);
      }
      if (runId !== voiceRunIdRef.current) return;

      voiceAssistantTextRef.current = '';

      AudioManager.setSystemOptions({
        ios: {
          category: 'playAndRecord',
          mode: 'voiceChat',
          options: ['defaultToSpeaker'],
        },
        android: {
          mode: 'inCommunication',
          communicationDevice: 'speaker',
        },
      });

      await AudioManager.setAudioSessionActivity(true);
      voiceAudioSessionActiveRef.current = true;
      if (runId !== voiceRunIdRef.current) return;

      const audioContext = new AudioContext({
        sampleRate: LIVE_OUTPUT_SAMPLE_RATE,
        androidOutputProfile: 'voiceCommunication',
      });

      voiceAudioContextRef.current = audioContext;

      const playbackQueue = audioContext.createBufferQueueSource();
      playbackQueue.connect(audioContext.destination);
      voicePlaybackQueueRef.current = playbackQueue;
      // A new queue is created for every session. It may be started only once.
        voicePlaybackStartedQueueRef.current = null;

      await audioContext.resume();
      if (runId !== voiceRunIdRef.current) return;

      const model = tokenData.model || 'gemini-3.8-live';
      const socketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenData.token)}`;
      const socket = new WebSocket(socketUrl);
      voiceSocketRef.current = socket;

      let resolveSetup: () => void = () => undefined;
      let rejectSetup: (error: Error) => void = () => undefined;

      const setupPromise = new Promise<void>((resolve, reject) => {
        resolveSetup = resolve;
        rejectSetup = reject;
      });

      voiceSetupResolveRef.current = resolveSetup;
      voiceSetupRejectRef.current = rejectSetup;

      const setupTimeout = setTimeout(() => {
        rejectSetup(new Error(`${selectedCharacter.name}’s voice setup timed out. Check your internet connection and try again.`));
      }, 20000);

      socket.onopen = () => {
        if (runId !== voiceRunIdRef.current) {
          socket.close();
          return;
        }

        // Use the selected Gemini Live prebuilt voice and native audio output.
        const generationConfig = {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: tokenData.voiceName || selectedCharacter.voiceName,
              },
            },
          },
        };

        socket.send(JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig,
            sessionResumption: {},
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [{
                text: tokenData.systemInstruction || (
                  selectedCharacter.id === 'spongebob'
                    ? 'You are SpongeBob, a cheerful, playful and optimistic English practice buddy. Use bright, upbeat and expressive delivery with simple clear English for an A2 learner. Be kind, funny and encouraging.'
                    : EMMA_LIVE_PROMPT
                ),
              }],
            },
          },
        }));
      };

      socket.onmessage = async event => {
        if (runId !== voiceRunIdRef.current) return;

        try {
          const message = await parseGeminiLiveMessage(event.data);

          if (message.error?.message) {
            voiceSetupRejectRef.current?.(new Error(message.error.message));
            return;
          }

          if (message.setupComplete) {
            voiceSessionReadyRef.current = true;
            voiceSetupResolveRef.current?.();
            return;
          }

          const serverContent = message.serverContent;
          if (!serverContent) return;

          if (serverContent.interrupted) {
            voiceReplyIdRef.current += 1;
            voiceAssistantTextRef.current = '';
            // Keep the queue's started state: BufferQueueSourceNode.start() is one-shot.
            voicePlaybackQueueRef.current?.clearBuffers();
            setVoiceStatus('listening');
          }

          if (serverContent.inputTranscription?.text) {
            setVoiceTranscript(`You: ${serverContent.inputTranscription.text}`);
          }

          // Show the speech transcript while the audio response is playing.
          if (serverContent.outputTranscription?.text) {
            voiceAssistantTextRef.current += serverContent.outputTranscription.text;
            setVoiceTranscript(`${selectedCharacter.name}: ${voiceAssistantTextRef.current.trim()}`);
          }

          const parts = serverContent.modelTurn?.parts ?? [];

          // Both active characters play native Gemini Live audio directly.
          for (const part of parts) {
            const audioData = part.inlineData?.data;
            if (!audioData) continue;

            setVoiceStatus('speaking');
            const replyId = voiceReplyIdRef.current;

            voiceDecodeChainRef.current = voiceDecodeChainRef.current
              .then(async () => {
                if (replyId !== voiceReplyIdRef.current) return;

                const currentContext = voiceAudioContextRef.current;
                const currentQueue = voicePlaybackQueueRef.current;
                if (!currentContext || !currentQueue) return;

                const audioBuffer = await currentContext.decodePCMInBase64(
                  audioData,
                  LIVE_OUTPUT_SAMPLE_RATE,
                  1,
                );

                if (replyId !== voiceReplyIdRef.current) return;
                currentQueue.enqueueBuffer(audioBuffer);

                // BufferQueueSourceNode.start() is one-shot for each queue.
                if (voicePlaybackStartedQueueRef.current !== currentQueue) {
                  voicePlaybackStartedQueueRef.current = currentQueue;
                  currentQueue.start();
                }
              })
              .catch(error => {
                console.error('Gemini Live audio playback error:', error);
              });
          }

          if (serverContent.turnComplete && voiceStreamingRef.current) {
            voiceAssistantTextRef.current = '';
            setVoiceStatus('listening');
          }
        } catch (error) {
          console.error('Gemini Live message error:', error);
          if (!voiceSessionReadyRef.current) {
            voiceSetupRejectRef.current?.(
              error instanceof Error ? error : new Error('Could not decode the voice service response.'),
            );
          }
        }
      };

      socket.onerror = () => {
        rejectSetup(new Error(`${selectedCharacter.name}’s voice connection failed. Check your internet connection and try again.`));
      };

      socket.onclose = event => {
        if (runId !== voiceRunIdRef.current) return;

        if (!voiceSessionReadyRef.current) {
          rejectSetup(new Error(event.reason || `${selectedCharacter.name}’s voice session ended (code ${event.code}).`));
          return;
        }

        if (voiceStreamingRef.current && runId === voiceRunIdRef.current) {
          void stopVoice().then(() => {
            setVoiceStatus('error');
            Alert.alert(
              'Voice connection closed',
              event.reason || `${selectedCharacter.name}’s voice connection ended. Tap the microphone to reconnect.`,
            );
          });
        }
      };

      try {
        await setupPromise;
      } finally {
        clearTimeout(setupTimeout);
        voiceSetupResolveRef.current = null;
        voiceSetupRejectRef.current = null;
      }

      if (runId !== voiceRunIdRef.current) return;

      const recorder = new AudioRecorder({
        androidInputPreset: 'voiceCommunication',
        iosVoiceProcessing: true,
      });

      voiceRecorderRef.current = recorder;

      recorder.onAudioReady(
        {
          sampleRate: LIVE_SAMPLE_RATE,
          bufferLength: LIVE_SAMPLE_RATE / 10,
          channelCount: 1,
        },
        ({ buffer, numFrames }) => {
          const activeSocket = voiceSocketRef.current;

          if (
            !voiceStreamingRef.current ||
            !voiceSessionReadyRef.current ||
            !activeSocket ||
            activeSocket.readyState !== WebSocket.OPEN
          ) {
            return;
          }

          const source = buffer.getChannelData(0).subarray(0, numFrames);
          const samples = resampleMono(source, buffer.sampleRate, LIVE_SAMPLE_RATE);
          const data = encodePcm16Base64(samples);

          if (!data) return;

          activeSocket.send(JSON.stringify({
            realtimeInput: {
              audio: {
                data,
                mimeType: 'audio/pcm;rate=16000',
              },
            },
          }));
        },
      );

      voiceStreamingRef.current = true;

      const startResult = await recorder.start();

      if (startResult.status === 'error') {
        voiceStreamingRef.current = false;
        throw new Error(startResult.message || 'The microphone could not start.');
      }

      voiceRecorderActiveRef.current = true;

      if (runId !== voiceRunIdRef.current) {
        await stopVoice();
        return;
      }

      setRecording(true);
      setVoiceStatus('listening');
    } catch (error) {
      if (runId !== voiceRunIdRef.current) return;

      console.error(`${selectedCharacter.name} Live Voice Error:`, error);
      await stopVoice();
      setVoiceStatus('error');

      Alert.alert(
        'Could not start voice chat',
        error instanceof Error ? error.message : `${selectedCharacter.name} could not connect. Check the network and try again.`,
      );
    }
  };

  const voiceStopRef = useRef<() => Promise<void>>(stopVoice);
  voiceStopRef.current = stopVoice;

  useEffect(() => {
    if (screen !== 'voice' && (voiceStreamingRef.current || voiceStatus === 'connecting')) {
      void voiceStopRef.current();
    }
  }, [screen, voiceStatus]);

  useEffect(() => () => {
    void voiceStopRef.current();
  }, []);

  const toggleSaveWord = (word: string) => {
    setSavedWords(words => words.includes(word) ? words.filter(item => item !== word) : [...words, word]);
  };

  const renderWelcome = () => (
    <ImageBackground
      source={EMMA}
      resizeMode="cover"
      style={styles.welcomeBackground}
    >
      <View style={styles.welcomeOverlay} />

      <ScrollView
        contentContainerStyle={[
          styles.welcomeContent,
          {
            paddingTop: 24,
            paddingBottom: Math.max(28, insets.bottom + 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <WelcomeEntrance index={0}>
          <View style={styles.brandMark}>
            <Icon name="pulse" size={34} color={C.gold} />
          </View>
        </WelcomeEntrance>

        <WelcomeEntrance index={1}>
          <Text style={styles.brandTitle}>
            BOB <Text style={{ color: C.gold }}>ENGLISH</Text>
          </Text>
        </WelcomeEntrance>

        <WelcomeEntrance index={2}>
          <Text style={styles.brandSubtitle}>
            Your personal AI English tutor
          </Text>
        </WelcomeEntrance>

        <View style={styles.welcomePoints}>
          {[
            'Talk naturally with AI',
            'Real-life conversations',
            'Get corrections and tips',
            'Build vocabulary & grammar',
            'Improve your pronunciation',
          ].map((item, index) => (
            <WelcomeEntrance key={item} index={3 + index}>
              <View style={styles.welcomePoint}>
                <Icon
                  name="checkmark-circle"
                  size={18}
                  color={C.gold}
                />
                <Text style={styles.welcomePointText}>
                  {item}
                </Text>
              </View>
            </WelcomeEntrance>
          ))}
        </View>

        <WelcomeEntrance index={8}>
          <AppButton
            title="Start Learning"
            icon="arrow-forward"
            onPress={() => {
              historyRef.current = [];
              setActiveTab('home');
              screenRef.current = 'home';
              setScreen('home');
            }}
          />
        </WelcomeEntrance>

        <WelcomeEntrance index={9}>
          <Text style={styles.welcomeFooter}>
            A little English every day makes a big difference.
          </Text>
        </WelcomeEntrance>
      </ScrollView>
    </ImageBackground>
  );

  const renderHome = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <View style={styles.homeTop}>
        <View style={styles.greetingBlock}>
          <Text style={styles.eyebrow}>YOUR DAILY ENGLISH ROUTINE</Text>
          <Text style={styles.greeting}>Hi there!</Text>
          <Text style={styles.mutedText}>Ready to practise English?</Text>
        </View>
        <Pressable onPress={() => navigate('profile')} style={styles.streakPill}>
          <Icon name="flame" size={16} color={C.gold} />
          <Text style={styles.streakText}>7 days</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigate('lesson')} style={styles.continueCard}>
        <ImageBackground source={EMMA} imageStyle={styles.continueImage} style={styles.continueImageWrap}>
          <View style={styles.continueShade} />
          <View style={styles.continueContent}>
            <Text style={styles.cardKicker}>CONTINUE YOUR JOURNEY</Text>
            <Text style={styles.continueTitle}>Café Conversation</Text>
            <Text style={styles.continueMeta}>Lesson 3 of 5</Text>
            <ProgressBar progress={60} />
            <View style={styles.continueBottom}>
              <Text style={styles.continueMeta}>3 / 5 steps completed</Text>
              <View style={styles.playCircle}><Icon name="play" size={18} color="#2B180D" /></View>
            </View>
          </View>
        </ImageBackground>
      </Pressable>

      <SectionTitle title="Explore learning" />

      <View style={styles.featureGrid}>
        <FeatureTile icon="chatbubble-ellipses-outline" title="AI Chat" subtitle="Talk freely" onPress={() => openChat('Free Conversation')} />
        <FeatureTile icon="briefcase-outline" title="Scenarios" subtitle="Real-life" onPress={() => navigate('practice')} />
        <FeatureTile icon="book-outline" title="Vocabulary" subtitle="New words" onPress={() => navigate('vocabulary')} />
        <FeatureTile icon="library-outline" title="Grammar" subtitle="With examples" onPress={() => navigate('correction')} />
        <FeatureTile icon="headset-outline" title="Listening" subtitle="Train your ear" onPress={() => navigate('learn')} />
        <FeatureTile icon="mic-outline" title="Speaking" subtitle="Speak clearly" onPress={() => navigate('voice')} />
      </View>

      <Pressable onPress={() => navigate('progress')} style={styles.goalCard}>
        <View style={styles.goalIcon}><Icon name="trophy-outline" size={24} color={C.gold} /></View>
        <View style={styles.goalCopy}>
          <Text style={styles.goalTitle}>Today's Goal</Text>
          <Text style={styles.goalText}>Have a 5-minute conversation in English</Text>
          <ProgressBar progress={60} color={C.green} />
        </View>
        <View style={styles.goalPercent}><Text style={styles.goalPercentText}>60%</Text></View>
      </Pressable>

      <SectionTitle title="Try a real conversation" action="See all" onAction={() => navigate('practice')} />

      <View style={styles.inlineScenarios}>
        <ScenarioCard icon="cafe-outline" title="At a café" detail="Order a drink and chat" onPress={() => openChat('Café Conversation')} />
        <ScenarioCard icon="airplane-outline" title="At the airport" detail="Check in and ask questions" onPress={() => openChat('Airport Travel')} />
      </View>
    </StaggeredScrollView>
  );

  const renderPractice = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>SPEAK WITH CONFIDENCE</Text>
        <Text style={styles.pageHeading}>Real-life scenarios</Text>
        <Text style={styles.mutedText}>Practise the English you'll use in everyday life.</Text>
      </View>

      <View style={styles.practiceBanner}>
        <View>
          <Text style={styles.cardKicker}>TODAY'S CHALLENGE</Text>
          <Text style={styles.bannerTitle}>Speak for 5 minutes</Text>
          <Text style={styles.bannerDetail}>Pick a situation and start talking with Emma.</Text>
        </View>
        <View style={styles.bannerIcon}><Icon name="mic" size={30} color={C.gold} /></View>
      </View>

      <SectionTitle title="Choose a situation" />

      <ScenarioCard icon="cafe-outline" title="Café Conversation" detail="Order a drink, make small talk and share preferences." onPress={() => openChat('Café Conversation')} />
      <ScenarioCard icon="airplane-outline" title="At the Airport" detail="Check in, ask about your flight and find your gate." onPress={() => openChat('Airport Travel')} />
      <ScenarioCard icon="briefcase-outline" title="Job Interview" detail="Introduce yourself and answer common questions." onPress={() => openChat('Job Interview')} />
      <ScenarioCard icon="bed-outline" title="At the Hotel" detail="Book a room and ask for help at reception." onPress={() => openChat('Hotel Check-in')} />
      <ScenarioCard icon="school-outline" title="At the University" detail="Meet new people and talk about your studies." onPress={() => openChat('University Life')} />
      <ScenarioCard icon="restaurant-outline" title="At a Restaurant" detail="Read a menu, order food and ask for the bill." onPress={() => openChat('Restaurant Conversation')} />

      <View style={styles.tipCard}>
        <Icon name="bulb-outline" size={20} color={C.gold} />
        <Text style={styles.tipText}>Tip: Don't worry about making mistakes. Emma will help you say it more naturally.</Text>
      </View>
    </StaggeredScrollView>
  );

  const renderLearn = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>LEARN STEP BY STEP</Text>
        <Text style={styles.pageHeading}>Your learning path</Text>
        <Text style={styles.mutedText}>Short lessons that help you speak more naturally.</Text>
      </View>

      <View style={styles.levelCard}>
        <View style={styles.levelCircle}>
          <Text style={styles.levelText}>A2</Text>
          <Text style={styles.levelSub}>ELEMENTARY</Text>
        </View>
        <View style={styles.levelInfo}>
          <Text style={styles.levelTitle}>You're making progress</Text>
          <Text style={styles.mutedText}>9 of 16 lessons completed</Text>
          <ProgressBar progress={56} />
          <Text style={styles.levelHint}>Next milestone: B1 Intermediate</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['Grammar', 'Listening', 'Reading'] as const).map(filter => (
          <Pressable
            key={filter}
            onPress={() => setLearnFilter(filter)}
            style={[styles.filterChip, learnFilter === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, learnFilter === filter && styles.filterTextActive]}>{filter}</Text>
          </Pressable>
        ))}
      </View>

      {learnFilter === 'Grammar' ? (
        <>
          <View style={styles.lessonFeature}>
            <View style={styles.lessonFeatureIcon}><Icon name="book-open-outline" size={28} color={C.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardKicker}>GRAMMAR FOCUS</Text>
              <Text style={styles.lessonFeatureTitle}>Present Simple</Text>
              <Text style={styles.lessonFeatureDetail}>For habits, routines and general truths.</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={C.gold} />
          </View>

          <SectionTitle title="Lesson outline" />

          {['What is the Present Simple?', 'How to use it', 'Positive and negative sentences', 'Questions and short answers', 'Practice with Emma'].map((item, i) => (
            <Pressable key={item} onPress={() => i === 4 ? openChat('Present Simple Practice') : navigate('correction')} style={styles.outlineRow}>
              <View style={styles.outlineNumber}><Text style={styles.outlineNumberText}>{i + 1}</Text></View>
              <Text style={styles.outlineText}>{item}</Text>
              <Icon name="chevron-forward" size={18} color={C.dim} />
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <View style={styles.lessonFeature}>
            <View style={styles.lessonFeatureIcon}>
              <Icon name={learnFilter === 'Listening' ? 'headset-outline' : 'newspaper-outline'} size={28} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardKicker}>{learnFilter.toUpperCase()} PRACTICE</Text>
              <Text style={styles.lessonFeatureTitle}>{learnFilter === 'Listening' ? 'A morning at the café' : 'A day in my life'}</Text>
              <Text style={styles.lessonFeatureDetail}>
                {learnFilter === 'Listening'
                  ? 'Listen to Emma and understand a natural conversation.'
                  : 'Read a short first-person story and learn useful phrases.'}
              </Text>
            </View>
          </View>
          <AppButton title={`Start ${learnFilter} lesson`} icon="arrow-forward" onPress={() => openChat(`${learnFilter} Practice`)} />
        </>
      )}

      <SectionTitle title="More lessons" />
      <ScenarioCard icon="chatbubble-outline" title="Introduce Yourself" detail="Talk about your name, work and interests." onPress={() => openChat('Introducing Yourself')} />
      <ScenarioCard icon="calendar-outline" title="My Daily Routine" detail="Describe your everyday activities." onPress={() => openChat('Daily Routine')} />
    </StaggeredScrollView>
  );

  const renderProgress = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>YOUR ACHIEVEMENTS</Text>
        <Text style={styles.pageHeading}>My progress</Text>
        <Text style={styles.mutedText}>Every conversation makes you stronger.</Text>
      </View>

      <View style={styles.progressHero}>
        <View style={styles.bigLevel}>
          <Text style={styles.bigLevelLabel}>A2</Text>
          <Text style={styles.bigLevelSub}>Elementary</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardKicker}>CURRENT LEVEL</Text>
          <Text style={styles.progressHeroTitle}>Keep going!</Text>
          <Text style={styles.mutedText}>You're building a strong foundation.</Text>

          <AnimatedProgressBar
            progress={72}
            color={C.green}
            delay={250}
          />

          <Text style={styles.levelHint}>
            <AnimatedCount value={72} suffix="%" delay={250} />
            {' '}to your next level
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon="chatbubble-ellipses-outline"
          value="12"
          label="Conversations"
          delay={200}
        />

        <StatCard
          icon="book-outline"
          value="320"
          label="New words"
          delay={400}
        />

        <StatCard
          icon="mic-outline"
          value="87%"
          label="Speaking score"
          delay={600}
        />

        <StatCard
          icon="flame-outline"
          value="7"
          label="Day streak"
          delay={800}
        />
      </View>

      <SectionTitle title="Your skills" />

      {[
        ['Speaking', 72],
        ['Listening', 85],
        ['Vocabulary', 78],
        ['Grammar', 64],
      ].map(([label, value], index) => (
        <View key={String(label)} style={styles.skillRow}>
          <View style={styles.skillTitleRow}>
            <Text style={styles.skillName}>{label}</Text>

            <AnimatedCount
              value={Number(value)}
              suffix="%"
              delay={650 + index * 140}
              style={styles.skillValue}
            />
          </View>

          <AnimatedProgressBar
            progress={Number(value)}
            color={C.gold}
            delay={650 + index * 140}
          />
        </View>
      ))}

      <View style={styles.weekCard}>
        <Text style={styles.goalTitle}>Weekly activity</Text>
        <Text style={styles.mutedText}>You practised 5 days this week.</Text>

        <View style={styles.weekBars}>
          {[35, 60, 48, 78, 88, 100, 54].map((height, index) => (
            <View key={index} style={styles.weekBarColumn}>
              <AnimatedWeekBar height={height} index={index} />

              <Text style={styles.weekDay}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </StaggeredScrollView>
  );

  function StatCard({
    icon,
    value,
    label,
    delay = 0,
  }: {
    icon: IconName;
    value: string;
    label: string;
    delay?: number;
  }) {
    const numericValue = Number.parseInt(value, 10);
    const suffix = value.includes('%') ? '%' : '';

    return (
      <View style={styles.statCard}>
        <Icon name={icon} size={22} color={C.gold} />

        <AnimatedCount
          value={numericValue}
          suffix={suffix}
          delay={delay}
          duration={1400}
          style={styles.statValue}
        />

        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  }

  const renderProfile = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>YOUR PERSONAL SPACE</Text>
        <Text style={styles.pageHeading}>My profile</Text>
      </View>

      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Icon name="person" size={34} color={C.gold} /></View>
        <Text style={styles.profileName}>English Learner</Text>
        <Text style={styles.mutedText}>A2 · Elementary</Text>
        <View style={styles.memberPill}>
          <Icon name="ribbon-outline" color={C.gold} size={15} />
          <Text style={styles.memberPillText}>7-day learning streak</Text>
        </View>
      </View>

      <SectionTitle title="Learning preferences" />
      <ProfileRow icon="language-outline" title="Learning language" value="English" />
      <ProfileRow icon="bar-chart-outline" title="My level" value="A2 · Elementary" />
      <ProfileRow icon="notifications-outline" title="Daily reminders" value="On" />
      <ProfileRow icon="bookmark-outline" title="Saved vocabulary" value={`${savedWords.length} words`} onPress={() => navigate('vocabulary')} />
      <ProfileRow icon="settings-outline" title="Settings" value="Personalise your app" onPress={() => Alert.alert('Settings', 'More settings will be added in the next build.')} />

      <View style={styles.tipCard}>
        <Icon name="heart-outline" size={20} color={C.gold} />
        <Text style={styles.tipText}>Your goal is progress, not perfection. Keep speaking!</Text>
      </View>
    </StaggeredScrollView>
  );

  function ProfileRow({ icon, title, value, onPress }: { icon: IconName; title: string; value: string; onPress?: () => void }) {
    return (
      <Pressable onPress={onPress} style={styles.profileRow}>
        <View style={styles.profileRowIcon}><Icon name={icon} size={20} color={C.gold} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileRowTitle}>{title}</Text>
          <Text style={styles.profileRowValue}>{value}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={C.dim} />
      </Pressable>
    );
  }

  const renderVocabulary = () => {
    const words = [
      { word: 'usually', type: 'adverb', meaning: 'In most situations; most of the time.', example: 'I usually have a coffee in the morning.' },
      { word: 'prefer', type: 'verb', meaning: 'To like one thing more than another.', example: 'I prefer tea to coffee.' },
      { word: 'friendly', type: 'adjective', meaning: 'Kind and pleasant towards other people.', example: 'The people in this café are friendly.' },
      { word: 'order', type: 'verb', meaning: 'To ask for food or a drink in a café.', example: 'I would like to order a cappuccino.' },
      { word: 'comfortable', type: 'adjective', meaning: 'Relaxed and feeling good.', example: 'I feel comfortable speaking English.' },
    ];

    return (
      <StaggeredScrollView {...scrollProps} animationKey={screen}>
        <ScreenHeader title="Vocabulary" onBack={goBack} right={<Icon name="search-outline" size={21} color={C.cream} />} />

        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>WORDS FROM YOUR JOURNEY</Text>
          <Text style={styles.pageHeading}>Build your vocabulary</Text>
          <Text style={styles.mutedText}>Listen, learn and save useful words.</Text>
        </View>

        <View style={styles.wordSummary}>
          <View><Text style={styles.wordSummaryNumber}>320</Text><Text style={styles.mutedText}>Words learned</Text></View>
          <View style={styles.wordSummaryDivider} />
          <View><Text style={styles.wordSummaryNumber}>{savedWords.length}</Text><Text style={styles.mutedText}>Saved words</Text></View>
          <View style={styles.wordSummaryDivider} />
          <View><Text style={styles.wordSummaryNumber}>24</Text><Text style={styles.mutedText}>To review</Text></View>
        </View>

        {words.map(item => (
          <View key={item.word} style={styles.wordCard}>
            <View style={styles.wordTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wordName}>{item.word}</Text>
                <Text style={styles.wordType}>{item.type}</Text>
              </View>
              <Pressable onPress={() => toggleSaveWord(item.word)} style={styles.wordAction}>
                <Icon name={savedWords.includes(item.word) ? 'bookmark' : 'bookmark-outline'} size={20} color={C.gold} />
              </Pressable>
            </View>
            <Text style={styles.wordMeaning}>{item.meaning}</Text>
            <View style={styles.wordExample}>
              <Text style={styles.wordExampleLabel}>EXAMPLE</Text>
              <Text style={styles.wordExampleText}>{item.example}</Text>
            </View>
          </View>
        ))}
      </StaggeredScrollView>
    );
  };

  const renderChat = () => (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      <View style={styles.chatHeader}>
        <Pressable onPress={goBack} style={styles.backButton}><Icon name="chevron-back" size={22} /></Pressable>
        <Avatar size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.chatHeaderTitle}>Emma <Text style={styles.chatHeaderAI}>(AI Tutor)</Text></Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online · {scenario}</Text>
          </View>
        </View>
        <Pressable style={styles.chatHeaderAction} onPress={() => navigate('voice')}><Icon name="call-outline" size={21} color={C.gold} /></Pressable>
        <Pressable style={styles.chatHeaderAction} onPress={() => Alert.alert('Conversation', 'Your practice conversation is saved in this demo session.')}><Icon name="ellipsis-vertical" size={19} color={C.cream} /></Pressable>
      </View>

      <ScrollView
        style={styles.chatScroll}
        contentContainerStyle={styles.chatMessages}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        <Image source={EMMA} style={styles.chatHeroImage} />
        <View style={styles.chatWelcomePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.chatWelcomeText}>Emma · Your English speaking partner</Text>
        </View>

        {chatMessages.map(message => (
          <View key={message.id} style={[styles.messageRow, message.from === 'you' && styles.messageRowYou]}>
            {message.from === 'emma' ? <Avatar size={30} /> : null}
            <View style={[styles.messageBubble, message.from === 'you' ? styles.messageBubbleYou : styles.messageBubbleEmma]}>
              <Text style={[styles.messageText, message.from === 'you' && styles.messageTextYou]}>{message.text}</Text>
              <Text style={[styles.messageTime, message.from === 'you' && styles.messageTimeYou]}>{message.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.quickReplyRow}>
        {['Yes, I do.', 'Not really.', 'What about you?'].map(item => (
          <Pressable key={item} onPress={() => setChatInput(item)} style={styles.quickReply}>
            <Text style={styles.quickReplyText}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.composerWrap}>
        <Pressable style={styles.composerAdd} onPress={() => navigate('vocabulary')}><Icon name="add" size={23} color={C.gold} /></Pressable>
        <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Type in English..." placeholderTextColor={C.dim} style={styles.composerInput} returnKeyType="send" onSubmitEditing={sendMessage} />
        <Pressable style={styles.composerMic} onPress={() => navigate('voice')}><Icon name="mic" size={21} color="#2B180D" /></Pressable>
        <Pressable
          style={[styles.sendButton, chatSending && { opacity: 0.55 }]}
          onPress={sendMessage}
          disabled={chatSending || !chatInput.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message to Emma"
          accessibilityState={{ disabled: chatSending || !chatInput.trim() }}
        >
          <Icon name="send" size={18} color="#2B180D" />
        </Pressable>
      </View>

      <View style={styles.demoNotice}>
        <Icon name="information-circle-outline" size={14} color={C.dim} />
        <Text style={styles.demoNoticeText}>
          {chatSending ? 'Emma is thinking...' : 'Emma is ready to help you practise.'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );

  const renderVoice = () => (
    <View style={[styles.voiceScreen, { backgroundColor: selectedCharacter.screen }]}>
      <ScreenHeader title={`${selectedCharacter.name} · Voice`} onBack={goBack} right={<Icon name="ellipsis-horizontal" size={20} color={C.cream} />} />

      <View style={[styles.voiceProgress, { backgroundColor: selectedCharacter.surface, borderColor: selectedCharacter.accent }]}>
        <Text style={[styles.cardKicker, { color: selectedCharacter.accent }]}>{scenario.toUpperCase()}</Text>
        <Text style={styles.voiceStep}>Speak naturally with {selectedCharacter.name}</Text>
        <ProgressBar progress={60} color={selectedCharacter.accent} />
      </View>

      <View style={styles.voiceCenter}>
        <View style={[
          styles.voiceAvatarHalo,
          { borderColor: recording ? C.green : selectedCharacter.accent, shadowColor: recording ? C.green : selectedCharacter.accent },
        ]}>
          <Image source={selectedCharacter.image} style={styles.voiceAvatar} />
        </View>

        <View style={styles.characterIdentity}>
          <Text style={[styles.characterIdentityName, { color: selectedCharacter.accent }]}>{selectedCharacter.name}</Text>
          <Text style={styles.characterIdentityRole}>{selectedCharacter.role} · {selectedCharacter.voiceStyle} voice</Text>
        </View>

        <View style={styles.waveRow}>
          {Array.from({ length: 23 }).map((_, index) => (
            <View key={index} style={[styles.waveBar, { height: 10 + ((index * 17) % 33), opacity: recording ? 1 : 0.5, backgroundColor: selectedCharacter.accent }]} />
          ))}
        </View>

        <Text style={styles.voiceStatus}>
          {voiceStatus === 'connecting'
            ? `Connecting to ${selectedCharacter.name}...`
            : voiceStatus === 'speaking'
              ? `${selectedCharacter.name} is speaking...`
              : recording
                ? `${selectedCharacter.name} is listening...`
                : voiceStatus === 'error'
                  ? 'Voice connection stopped'
                  : `${selectedCharacter.name} is ready when you are`}
        </Text>

        <Text style={styles.voiceHint}>
          {voiceStatus === 'connecting'
            ? 'Preparing your live voice session.'
            : recording
              ? `Speak naturally. You can interrupt ${selectedCharacter.name} at any time.`
              : 'Tap the microphone and speak in English.'}
        </Text>

        {voiceTranscript ? (
          <Text style={[styles.voiceTranscript, { color: selectedCharacter.accent }]} numberOfLines={3}>{voiceTranscript}</Text>
        ) : null}
      </View>

      <View style={styles.voiceControls}>
        <Pressable
          style={[styles.voiceSmallButton, { borderColor: selectedCharacter.accent }]}
          onPress={() => navigate('chat')}
          accessibilityRole="button"
          accessibilityLabel="Return to text chat"
        >
          <Icon name="keypad-outline" size={22} color={C.cream} />
        </Pressable>

        <Pressable
          onPress={recording ? stopVoice : startVoice}
          disabled={voiceStatus === 'connecting'}
          style={[
            styles.voiceMicButton,
            { backgroundColor: recording ? C.green : selectedCharacter.accent, borderColor: selectedCharacter.surface, shadowColor: selectedCharacter.accent },
            voiceStatus === 'connecting' && { opacity: 0.65 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'End voice conversation' : `Start ${selectedCharacter.name} voice conversation`}
          accessibilityState={{ disabled: voiceStatus === 'connecting' }}
        >
          <Icon name={recording ? 'stop' : 'mic'} size={34} color="#2B180D" />
        </Pressable>

        <Pressable
          style={[styles.voiceSmallButton, { borderColor: selectedCharacter.accent }]}
          onPress={openVoiceSettings}
          accessibilityRole="button"
          accessibilityLabel="Open character settings"
          accessibilityHint="View character and speaking settings."
        >
          <Icon name="options-outline" size={22} color={C.cream} />
        </Pressable>
      </View>

      <View style={styles.demoNotice}>
        <Icon name="information-circle-outline" size={14} color={selectedCharacter.accent} />
        <Text style={styles.demoNoticeText}>
          {voiceStatus === 'connecting'
            ? `Preparing ${selectedCharacter.name}’s voice...`
            : recording
              ? `${selectedCharacter.name} connected · Microphone active`
              : voiceStatus === 'error'
                ? 'Voice connection ended · Tap the microphone to retry'
                : `${selectedCharacter.name} · Voice assistant`}
        </Text>
      </View>
    </View>
  );

  const renderCorrection = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <ScreenHeader title="Correction & tips" onBack={goBack} />

      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>LEARN FROM YOUR MISTAKES</Text>
        <Text style={styles.pageHeading}>Say it naturally</Text>
        <Text style={styles.mutedText}>A small correction can make a big difference.</Text>
      </View>

      <View style={styles.correctionCard}>
        <View style={styles.correctionLabel}><Icon name="close-circle" size={18} color={C.red} /><Text style={styles.correctionLabelText}>YOUR SENTENCE</Text></View>
        <Text style={styles.correctionSentence}>I usually drink coffee with milk.</Text>
        <View style={styles.correctionDivider} />
        <View style={styles.correctionLabel}><Icon name="checkmark-circle" size={18} color={C.green} /><Text style={styles.correctionLabelText}>MORE NATURAL</Text></View>
        <Text style={styles.correctedSentence}>I usually have a coffee with milk.</Text>
      </View>

      <View style={styles.tipCard}>
        <Icon name="bulb-outline" size={21} color={C.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.goalTitle}>Why?</Text>
          <Text style={styles.tipText}>Both sentences are understandable. In everyday English, people often say “have a coffee” when they mean drinking one cup.</Text>
        </View>
      </View>

      <SectionTitle title="Useful grammar" />

      <View style={styles.grammarCard}>
        <Text style={styles.lessonFeatureTitle}>Present Simple</Text>
        <Text style={styles.mutedText}>Use it for habits, routines and facts.</Text>
        <Text style={styles.grammarExample}>I drink coffee every morning.</Text>
        <Text style={styles.grammarExample}>She works in a café.</Text>
        <Text style={styles.grammarExample}>Do you like tea?</Text>
      </View>

      <AppButton title="Practise with Emma" icon="arrow-forward" onPress={() => openChat('Grammar Practice')} />
    </StaggeredScrollView>
  );

  const renderLesson = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <ScreenHeader title="Café conversation" onBack={goBack} />

      <ImageBackground source={EMMA} imageStyle={styles.lessonImage} style={styles.lessonImageWrap}>
        <View style={styles.lessonImageShade} />
        <View style={styles.lessonImageContent}>
          <Text style={styles.cardKicker}>A2 · ELEMENTARY</Text>
          <Text style={styles.lessonHeroTitle}>Ordering at a café</Text>
          <Text style={styles.lessonHeroText}>Learn how to order a drink and make friendly conversation.</Text>
        </View>
      </ImageBackground>

      <View style={styles.lessonProgressRow}>
        <Text style={styles.goalTitle}>Your lesson</Text>
        <Text style={styles.mutedText}>3 / 5 steps</Text>
      </View>
      <ProgressBar progress={60} />

      {[
        ['checkmark-circle', 'Greeting and small talk', 'Completed'],
        ['checkmark-circle', 'Ordering a drink', 'Completed'],
        ['play-circle', 'Talking about preferences', 'Current step'],
        ['ellipse-outline', 'Asking and answering questions', 'Next'],
        ['ellipse-outline', 'A short free conversation', 'Next'],
      ].map(([icon, title, state], index) => (
        <View key={title} style={styles.lessonStep}>
          <Icon name={icon as IconName} size={23} color={index < 2 ? C.green : index === 2 ? C.gold : C.dim} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lessonStepTitle}>Step {index + 1} · {title}</Text>
            <Text style={styles.lessonStepState}>{state}</Text>
          </View>
          {index === 2 ? <Icon name="play-circle" size={23} color={C.gold} /> : null}
        </View>
      ))}

      <AppButton title="Continue lesson" icon="arrow-forward" onPress={() => openChat('Café Conversation')} />
    </StaggeredScrollView>
  );

  const renderMainContent = () => {
    switch (screen) {
      case 'home': return renderHome();
      case 'practice': return renderPractice();
      case 'learn': return renderLearn();
      case 'progress': return renderProgress();
      case 'profile': return renderProfile();
      case 'vocabulary': return renderVocabulary();
      case 'chat': return renderChat();
      case 'voice': return renderVoice();
      case 'correction': return renderCorrection();
      case 'lesson': return renderLesson();
      default: return renderHome();
    }
  };

  const isMainTab = (['home', 'practice', 'learn', 'progress', 'profile'] as Screen[]).includes(screen);

  const safeAreaEdges: ('top' | 'left' | 'right' | 'bottom')[] = (isMainTab || screen === 'welcome')
    ? ['top', 'left', 'right']
    : ['top', 'left', 'right', 'bottom'];

  return (
    <SafeAreaView style={styles.appRoot} edges={safeAreaEdges}>
      <StatusBar barStyle="light-content" />

      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
        {screen === 'welcome'
          ? renderWelcome()
          : (
            <View style={[styles.mainContent, { paddingTop: shortScreen ? 2 : 6 }]}>
              {renderMainContent()}
            </View>
          )}
      </BlurTargetView>

      {isMainTab ? (
        <BottomTabs
          active={activeTab}
          onSelect={goTab}
          bottomInset={insets.bottom}
          blurTarget={blurTargetRef}
        />
      ) : null}

      <Modal
        visible={voiceSettingsVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setVoiceSettingsVisible(false)}
      >
        <View style={styles.voiceSettingsOverlay}>
          <Pressable
            style={styles.voiceSettingsBackdrop}
            onPress={() => setVoiceSettingsVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close character settings"
          />
          <View style={[styles.voiceSettingsSheet, { paddingBottom: Math.max(insets.bottom, 18), borderColor: draftCharacter.accent }]}>
            <View style={styles.voiceSettingsHandle} />
            <View style={styles.voiceSettingsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.voiceSettingsTitle}>Choose your character</Text>
                <Text style={styles.voiceSettingsSubtitle}>Choose your English speaking partner. Emma has a gentle voice, while SpongeBob has an upbeat Gemini voice.</Text>
              </View>
              <Pressable
                style={styles.voiceSettingsClose}
                onPress={() => setVoiceSettingsVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close character settings"
              >
                <Icon name="close" size={20} color={C.cream} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.voiceSettingsScroll}
              contentContainerStyle={styles.voiceSettingsContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.voiceSettingsSection}>
                <View style={styles.voiceSettingsSectionHeading}>
                  <Icon name="people-outline" size={18} color={draftCharacter.accent} />
                  <Text style={[styles.voiceSettingsSectionTitle, { color: draftCharacter.accent }]}>YOUR CHARACTERS</Text>
                </View>
                {Array.from({ length: Math.ceil(VOICE_CHARACTERS.length / 2) }).map((_, rowIndex) => (
                  <View key={`character-row-${rowIndex}`} style={styles.characterGridRow}>
                    {VOICE_CHARACTERS.slice(rowIndex * 2, rowIndex * 2 + 2).map(character => {
                      const selected = voiceSettingsDraft.characterId === character.id;
                      return (
                        <Pressable
                          key={character.id}
                          style={[
                            styles.characterOption,
                            selected && { borderColor: character.accent, backgroundColor: character.surface },
                          ]}
                          onPress={() => setVoiceSettingsDraft(current => ({ ...current, characterId: character.id }))}
                          accessibilityRole="radio"
                          accessibilityLabel={`${character.name}, ${character.role}, ${character.voiceStyle} voice`}
                          accessibilityState={{ selected }}
                        >
                          <Image source={character.image} style={[styles.characterOptionImage, { borderColor: character.accent }]} />
                          <View style={styles.characterOptionCopy}>
                            <Text numberOfLines={1} style={[styles.characterOptionName, selected && { color: character.accent }]}>{character.name}</Text>
                            <Text numberOfLines={1} style={styles.characterOptionRole}>{character.role}</Text>
                            <Text numberOfLines={1} style={styles.characterOptionVoice}>{`${character.voiceStyle} voice`}</Text>
                          </View>
                          <View style={[styles.characterOptionRadio, selected && { borderColor: character.accent }]}>
                            {selected ? <View style={[styles.characterOptionRadioDot, { backgroundColor: character.accent }]} /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.voiceSettingsSection}>
                <View style={styles.voiceSettingsSectionHeading}>
                  <Icon name="speedometer-outline" size={18} color={draftCharacter.accent} />
                  <Text style={[styles.voiceSettingsSectionTitle, { color: draftCharacter.accent }]}>SPEAKING PACE</Text>
                </View>
                <View style={styles.voicePaceRow}>
                  {PACE_OPTIONS.map(option => {
                    const selected = voiceSettingsDraft.speakingPace === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.voicePaceOption, selected && { borderColor: draftCharacter.accent, backgroundColor: draftCharacter.surface }]}
                        onPress={() => setVoiceSettingsDraft(current => ({ ...current, speakingPace: option.value }))}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.voicePaceTitle, selected && { color: draftCharacter.accent }]}>{option.title}</Text>
                        <Text style={styles.voicePaceDescription}>{option.description}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.voiceSettingsFootnote}>Pace is guided by the character's conversation instructions. It is not a fixed audio playback-speed control.</Text>
              </View>

              <View style={styles.voiceSettingsInfo}>
                <Icon name="information-circle-outline" size={18} color={draftCharacter.accent} />
                <Text style={styles.voiceSettingsInfoText}>Selected: {draftCharacter.name}. Saving changes the voice, personality, avatar and color theme for your next voice session. English practice stays in English.</Text>
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.voiceSettingsSave, { backgroundColor: draftCharacter.accent }, pressed && styles.pressed]}
              onPress={applyVoiceSettings}
              accessibilityRole="button"
              accessibilityLabel={`Save ${draftCharacter.name} as selected character`}
            >
              <Text style={styles.voiceSettingsSaveText}>Save {draftCharacter.name}</Text>
              <Icon name="checkmark" size={19} color="#2B180D" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  mainContent: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: 4 },
  scrollContent: { paddingTop: 10, paddingBottom: 28 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },

  blurTarget: { flex: 1 },

  welcomeBackground: { flex: 1, justifyContent: 'center' },
  welcomeOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,9,4,0.60)' },
  welcomeContent: { paddingHorizontal: 26, paddingBottom: 32, alignItems: 'flex-start', flexGrow: 1, justifyContent: 'flex-end' },
  brandMark: { width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(244,184,110,0.15)', borderWidth: 1, borderColor: 'rgba(244,184,110,0.7)', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  brandTitle: { color: C.white, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.7 },
  brandSubtitle: { color: C.cream, fontSize: 16, marginTop: 6 },
  welcomePoints: { marginTop: 28, marginBottom: 28, gap: 15 },
  welcomePoint: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  welcomePointText: { color: C.cream, fontSize: 15, fontWeight: '500' },
  welcomeFooter: { color: '#E2CBB5', fontSize: 11, marginTop: 18, alignSelf: 'center', width: '100%', textAlign: 'center' },

  button: { height: 54, backgroundColor: C.gold, borderRadius: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', shadowColor: C.gold2, shadowOpacity: 0.23, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  buttonCompact: { width: 'auto', height: 42, borderRadius: 14 },
  buttonText: { color: '#28170D', fontSize: 16, fontWeight: '800' },
  buttonTextSecondary: { color: C.cream },
  buttonTextCompact: { fontSize: 14 },

  homeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greetingBlock: { flex: 1 },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 },
  greeting: { color: C.white, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  mutedText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  streakPill: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 20 },
  streakText: { color: C.cream, fontWeight: '700', fontSize: 12 },

  continueCard: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: C.line, marginBottom: 24, height: 168, backgroundColor: C.card },
  continueImageWrap: { flex: 1, justifyContent: 'center' },
  continueImage: { opacity: 0.78 },
  continueShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(25,12,6,0.52)' },
  continueContent: { padding: 17 },
  cardKicker: { color: '#EBC08E', fontSize: 9, letterSpacing: 1.25, fontWeight: '800' },
  continueTitle: { color: C.white, fontSize: 21, fontWeight: '800', marginTop: 5, marginBottom: 3 },
  continueMeta: { color: '#E6D3C1', fontSize: 11, marginBottom: 8 },
  progressTrack: { height: 7, backgroundColor: 'rgba(255,242,226,0.16)', borderRadius: 20, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 20 },
  continueBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  playCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  seeAll: { color: C.gold, fontSize: 12, fontWeight: '700' },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18 },
  featureTile: { width: '31.5%', backgroundColor: C.card, borderWidth: 1, borderColor: '#4C3222', borderRadius: 16, minHeight: 111, paddingTop: 13, paddingBottom: 12, paddingHorizontal: 7, alignItems: 'center', marginBottom: 9 },
  featureIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#422A1A', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  featureTitle: { color: C.cream, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  featureSubtitle: { color: C.muted, fontSize: 9, marginTop: 3, textAlign: 'center' },

  goalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 24, gap: 11 },
  goalIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#49301D', alignItems: 'center', justifyContent: 'center' },
  goalCopy: { flex: 1 },
  goalTitle: { color: C.white, fontSize: 13, fontWeight: '800', marginBottom: 3 },
  goalText: { color: C.muted, fontSize: 10, marginBottom: 8 },
  goalPercent: { width: 43, height: 43, borderRadius: 22, borderWidth: 3, borderColor: C.gold, justifyContent: 'center', alignItems: 'center' },
  goalPercentText: { color: C.cream, fontSize: 11, fontWeight: '800' },

  inlineScenarios: { gap: 9 },
  scenarioCard: { minHeight: 73, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: '#4B3324', paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 },
  scenarioIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#482D1B', alignItems: 'center', justifyContent: 'center' },
  scenarioCopy: { flex: 1 },
  scenarioTitle: { color: C.white, fontSize: 13, fontWeight: '800', marginBottom: 3 },
  scenarioDetail: { color: C.muted, fontSize: 10, lineHeight: 14 },

  pageIntro: { marginBottom: 22, marginTop: 8 },
  pageHeading: { color: C.white, fontSize: 27, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, marginBottom: 3 },
  practiceBanner: { backgroundColor: '#41291A', borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  bannerTitle: { color: C.white, fontSize: 18, fontWeight: '800', marginTop: 7 },
  bannerDetail: { color: C.muted, fontSize: 11, marginTop: 5, maxWidth: 225 },
  bannerIcon: { width: 55, height: 55, borderRadius: 18, backgroundColor: '#54351F', alignItems: 'center', justifyContent: 'center' },

  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#3A2718', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#61432C', marginTop: 12, marginBottom: 18 },
  tipText: { color: '#E5D2BF', fontSize: 11, lineHeight: 17, flex: 1 },

  levelCard: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 16, borderRadius: 19, marginBottom: 20 },
  levelCircle: { width: 83, height: 83, borderRadius: 42, borderWidth: 4, borderColor: C.green, alignItems: 'center', justifyContent: 'center' },
  levelText: { color: C.cream, fontSize: 27, fontWeight: '900' },
  levelSub: { color: C.muted, fontSize: 8, fontWeight: '700' },
  levelInfo: { flex: 1, gap: 7 },
  levelTitle: { color: C.white, fontWeight: '800', fontSize: 15 },
  levelHint: { color: C.gold, fontSize: 10, marginTop: 4 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterChip: { borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 9, paddingHorizontal: 15 },
  filterChipActive: { borderColor: C.gold, backgroundColor: C.gold },
  filterText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: '#2B180D' },

  lessonFeature: { backgroundColor: '#3D281A', borderColor: '#6A482E', borderWidth: 1, borderRadius: 19, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 23 },
  lessonFeatureIcon: { width: 55, height: 55, borderRadius: 17, backgroundColor: '#563921', alignItems: 'center', justifyContent: 'center' },
  lessonFeatureTitle: { color: C.white, fontSize: 17, fontWeight: '800', marginTop: 5 },
  lessonFeatureDetail: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  outlineRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#3C2A1F' },
  outlineNumber: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#51351F', alignItems: 'center', justifyContent: 'center' },
  outlineNumberText: { color: C.gold, fontSize: 12, fontWeight: '800' },
  outlineText: { color: C.cream, fontSize: 12, flex: 1 },

  progressHero: { flexDirection: 'row', alignItems: 'center', gap: 17, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 17, marginBottom: 17 },
  bigLevel: { width: 105, height: 105, borderRadius: 54, borderWidth: 5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  bigLevelLabel: { color: C.white, fontSize: 31, fontWeight: '900' },
  bigLevelSub: { color: C.muted, fontSize: 9 },
  progressHeroTitle: { color: C.white, fontSize: 18, fontWeight: '800', marginTop: 7, marginBottom: 5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { width: '48.5%', padding: 15, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: '#4B3324', marginBottom: 9 },
  statValue: { color: C.white, fontSize: 23, fontWeight: '900', marginTop: 9 },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 1 },
  skillRow: { marginBottom: 15 },
  skillTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  skillName: { color: C.cream, fontSize: 12, fontWeight: '700' },
  skillValue: { color: C.gold, fontSize: 11, fontWeight: '800' },
  weekCard: { backgroundColor: C.card, borderRadius: 17, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 12 },
  weekBars: { height: 92, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 16 },
  weekBarColumn: { alignItems: 'center', gap: 7 },
  weekBar: { width: 18, borderRadius: 8, backgroundColor: C.gold },
  weekDay: { color: C.dim, fontSize: 9 },

  profileHero: { alignItems: 'center', backgroundColor: C.card, padding: 23, borderRadius: 20, borderWidth: 1, borderColor: C.line, marginBottom: 24 },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#52371F', borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileName: { color: C.white, fontWeight: '900', fontSize: 20, marginBottom: 4 },
  memberPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#49301D', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  memberPillText: { color: C.cream, fontSize: 10, fontWeight: '700' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: C.card, borderRadius: 15, borderWidth: 1, borderColor: '#4B3324', marginBottom: 9 },
  profileRowIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#4B301C', alignItems: 'center', justifyContent: 'center' },
  profileRowTitle: { color: C.cream, fontSize: 12, fontWeight: '800' },
  profileRowValue: { color: C.muted, fontSize: 10, marginTop: 3 },

  /* GLASS BOTTOM NAVIGATION STYLES */

  tabBarArea: {
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  tabBarShell: {
    minHeight: 66,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,184,110,0.32)',
    backgroundColor: 'rgba(33,20,14,0.58)',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 14,
  },
  tabBarBlur: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tabBarTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(33,20,14,0.34)',
  },
  tabBarRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    gap: 3,
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,242,226,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  tabItemActive: {
    backgroundColor: 'rgba(244,184,110,0.19)',
    borderColor: 'rgba(244,184,110,0.48)',
    shadowColor: '#F4B86E',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  tabItemPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  tabLabel: {
    color: C.dim,
    fontSize: 9,
    fontWeight: '600',
    flexShrink: 1,
  },
  tabLabelActive: {
    color: C.gold,
    fontWeight: '800',
  },

  screenHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A271A', alignItems: 'center', justifyContent: 'center' },
  screenTitle: { color: C.white, fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  headerRight: { width: 36, alignItems: 'flex-end' },

  wordSummary: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.card, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, marginBottom: 17 },
  wordSummaryNumber: { color: C.gold, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  wordSummaryDivider: { width: 1, backgroundColor: C.line },
  wordCard: { backgroundColor: C.card, borderRadius: 17, borderWidth: 1, borderColor: '#4C3323', padding: 15, marginBottom: 11 },
  wordTop: { flexDirection: 'row', alignItems: 'center' },
  wordName: { color: C.white, fontSize: 19, fontWeight: '900' },
  wordType: { color: C.gold, fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  wordAction: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#4C311D', alignItems: 'center', justifyContent: 'center' },
  wordMeaning: { color: C.cream, fontSize: 12, lineHeight: 18, marginTop: 12 },
  wordExample: { backgroundColor: '#3B281A', padding: 11, borderRadius: 12, marginTop: 12 },
  wordExampleLabel: { color: C.gold, fontSize: 8, letterSpacing: 1.1, fontWeight: '900', marginBottom: 5 },
  wordExampleText: { color: '#EAD9C9', fontSize: 11, lineHeight: 16, fontStyle: 'italic' },

  chatHeader: { minHeight: 62, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#3D2A1D' },
  chatHeaderTitle: { color: C.white, fontSize: 14, fontWeight: '800' },
  chatHeaderAI: { color: C.muted, fontSize: 10, fontWeight: '500' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  onlineText: { color: C.muted, fontSize: 9 },
  chatHeaderAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#3C291D', alignItems: 'center', justifyContent: 'center' },
  chatScroll: { flex: 1 },
  chatMessages: { paddingHorizontal: 15, paddingTop: 13, paddingBottom: 13 },
  chatHeroImage: { width: '100%', height: 166, borderRadius: 18, marginBottom: 11 },
  chatWelcomePill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#382619', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, marginBottom: 16 },
  chatWelcomeText: { color: C.cream, fontSize: 9, fontWeight: '700' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  messageRowYou: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17 },
  messageBubbleEmma: { backgroundColor: '#F5E7D8', borderBottomLeftRadius: 5 },
  messageBubbleYou: { backgroundColor: '#8A572D', borderBottomRightRadius: 5 },
  messageText: { color: '#2A1A10', fontSize: 13, lineHeight: 19 },
  messageTextYou: { color: '#FFF5EA' },
  messageTime: { color: '#8B7562', fontSize: 8, textAlign: 'right', marginTop: 5 },
  messageTimeYou: { color: '#EBD1B7' },
  quickReplyRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingVertical: 8 },
  quickReply: { borderRadius: 18, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#68472F', backgroundColor: '#302015' },
  quickReplyText: { color: C.cream, fontSize: 9, fontWeight: '700' },
  composerWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 7, borderTopWidth: 1, borderTopColor: '#3D2A1D' },
  composerAdd: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#372416', alignItems: 'center', justifyContent: 'center' },
  composerInput: { flex: 1, height: 43, borderRadius: 22, backgroundColor: '#302015', borderWidth: 1, borderColor: '#58402E', paddingHorizontal: 15, color: C.cream, fontSize: 12 },
  composerMic: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D9944B', alignItems: 'center', justifyContent: 'center' },
  demoNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: 7, paddingTop: 2 },
  demoNoticeText: { color: C.dim, fontSize: 8 },

  voiceScreen: { flex: 1, paddingHorizontal: 18, paddingTop: 5 },
  voiceProgress: { padding: 16, backgroundColor: C.card, borderRadius: 17, borderWidth: 1, borderColor: C.line },
  voiceStep: { color: C.white, fontSize: 16, fontWeight: '800', marginTop: 5, marginBottom: 12 },
  voiceCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 180 },
  voiceAvatarHalo: { width: 178, height: 178, borderRadius: 90, borderWidth: 4, borderColor: C.gold, padding: 5, shadowColor: C.gold, shadowOpacity: 0.24, shadowRadius: 22, elevation: 7 },
  voiceAvatarHaloActive: { borderColor: C.green, shadowColor: C.green },
  voiceAvatar: { width: '100%', height: '100%', borderRadius: 90 },
  characterIdentity: { alignItems: 'center', marginTop: 12 },
  characterIdentityName: { fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  characterIdentityRole: { color: C.muted, fontSize: 9, marginTop: 3, fontWeight: '700' },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 52, marginTop: 27 },
  waveBar: { width: 4, backgroundColor: C.gold, borderRadius: 5 },
  voiceStatus: { color: C.white, fontSize: 17, fontWeight: '800', marginTop: 20 },
  voiceHint: { color: C.muted, fontSize: 11, marginTop: 6, textAlign: 'center' },
  voiceTranscript: { color: C.gold, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 12, paddingHorizontal: 15 },
  voiceControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingBottom: 27 },
  voiceSmallButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A271A', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  voiceMicButton: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.gold, borderWidth: 6, borderColor: '#5A3C25', alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 },
  voiceMicButtonActive: { backgroundColor: C.green, borderColor: '#284A35' },

  voiceSettingsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
 voiceSettingsBackdrop: StyleSheet.absoluteFill,
  voiceSettingsSheet: { maxHeight: '88%', backgroundColor: '#21140D', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#62432F', paddingTop: 10, paddingHorizontal: 20 },
  voiceSettingsHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 3, backgroundColor: '#80634C', marginBottom: 18 },
  voiceSettingsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 10 },
  voiceSettingsTitle: { color: C.white, fontSize: 22, fontWeight: '900' },
  voiceSettingsSubtitle: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  voiceSettingsClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A271A', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  voiceSettingsScroll: { flexShrink: 1 },
  voiceSettingsContent: { paddingTop: 8, paddingBottom: 14, gap: 18 },
  voiceSettingsSection: { gap: 9 },
  voiceSettingsSectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  voiceSettingsSectionTitle: { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  characterGridRow: { flexDirection: 'row', gap: 9 },
  characterOption: { flex: 1, minWidth: 0, minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2B1B12', borderWidth: 1, borderColor: '#4D3525', borderRadius: 15, padding: 8 },
  characterOptionImage: { width: 54, height: 54, borderRadius: 13, borderWidth: 1.5 },
  characterOptionCopy: { flex: 1, minWidth: 0, gap: 3 },
  characterOptionName: { color: C.cream, fontSize: 11, fontWeight: '900' },
  characterOptionRole: { color: C.muted, fontSize: 8, fontWeight: '600' },
  characterOptionVoice: { color: C.dim, fontSize: 7, fontWeight: '700' },
  characterOptionRadio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#8F765F', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  characterOptionRadioDot: { width: 8, height: 8, borderRadius: 4 },
  voicePaceRow: { flexDirection: 'row', gap: 7 },
  voicePaceOption: { flex: 1, minHeight: 67, justifyContent: 'center', backgroundColor: '#2B1B12', borderWidth: 1, borderColor: '#4D3525', borderRadius: 13, paddingHorizontal: 8, paddingVertical: 10 },
  voicePaceOptionSelected: { borderColor: C.gold, backgroundColor: '#3A2819' },
  voicePaceTitle: { color: C.cream, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  voicePaceTitleSelected: { color: C.gold },
  voicePaceDescription: { color: C.dim, fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 5 },
  voiceSettingsFootnote: { color: C.dim, fontSize: 9, lineHeight: 14 },
  voiceSettingsInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderColor: '#62432F', backgroundColor: '#302015', borderRadius: 13, padding: 12 },
  voiceSettingsInfoText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15 },
  voiceSettingsSave: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.gold, borderRadius: 16, marginTop: 8, paddingHorizontal: 16 },
  voiceSettingsSaveText: { color: '#2B180D', fontSize: 13, fontWeight: '900' },

  correctionCard: { backgroundColor: C.card, padding: 17, borderRadius: 18, borderColor: C.line, borderWidth: 1, marginBottom: 13 },
  correctionLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  correctionLabelText: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  correctionSentence: { color: '#F0C8BC', fontSize: 16, lineHeight: 23, marginTop: 9, textDecorationLine: 'line-through' },
  correctionDivider: { height: 1, backgroundColor: C.line, marginVertical: 15 },
  correctedSentence: { color: C.green, fontSize: 16, lineHeight: 23, fontWeight: '800', marginTop: 9 },
  grammarCard: { backgroundColor: C.card, borderRadius: 17, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 18 },
  grammarExample: { color: C.cream, backgroundColor: '#3C281A', padding: 11, borderRadius: 10, marginTop: 9, fontSize: 12, fontStyle: 'italic' },

  lessonImageWrap: { height: 225, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 20, marginBottom: 17 },
  lessonImage: { borderRadius: 20 },
  lessonImageShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(21,10,4,0.52)' },
  lessonImageContent: { padding: 17 },
  lessonHeroTitle: { color: C.white, fontSize: 24, fontWeight: '900', marginTop: 6 },
  lessonHeroText: { color: '#EAD8C7', fontSize: 11, marginTop: 5, maxWidth: 275, lineHeight: 16 },
  lessonProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  lessonStep: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#3A281D' },
  lessonStepTitle: { color: C.cream, fontSize: 11, fontWeight: '800' },
  lessonStepState: { color: C.dim, fontSize: 9, marginTop: 3 },
});