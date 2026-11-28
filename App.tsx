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
import * as Speech from 'expo-speech';
import AnimatedPressable from './src/components/AnimatedPressable';
import AnimatedIconButton from './src/components/AnimatedIconButton';
import AnimatedTabItem from './src/components/AnimatedTabItem';

type IconName = string;
type Screen = 'welcome' | 'home' | 'practice' | 'learn' | 'progress' | 'profile' | 'chat' | 'voice' | 'vocabulary' | 'grammar' | 'correction' | 'lesson' | 'listening';
type Tab = 'home' | 'practice' | 'learn' | 'progress' | 'profile';
type ChatMessage = { id: number; from: 'emma' | 'you'; text: string; time: string };
type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
type CharacterId = 'emma';
type GeminiVoiceName = 'Achernar';
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
  speakingPace: VoicePace;
};

// Emma is the only English speaking partner in BOB ENGLISH.
const EMMA_CHARACTER: CharacterProfile = {
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
};

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
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://REPLACE_WITH_DEPLOYED_BACKEND_URL').replace(/\\/$/, '');
const LEARNER_ID_KEY = 'bob-english-learner-id';
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


const VOCABULARY_ITEMS = [
  { word: 'usually', type: 'adverb', meaning: 'In most situations; most of the time.', example: 'I usually study English after dinner.', quizOptions: ['Most of the time', 'Only one time', 'Never'], quizAnswer: 0 },
  { word: 'prefer', type: 'verb', meaning: 'To like one thing more than another.', example: 'I prefer tea to coffee.', quizOptions: ['To forget something', 'To like one thing more', 'To pay for something'], quizAnswer: 1 },
  { word: 'commute', type: 'verb', meaning: 'To travel regularly between home and work or school.', example: 'I commute to university by bus.', quizOptions: ['To travel to work or school', 'To cook dinner', 'To learn a language'], quizAnswer: 0 },
  { word: 'crowded', type: 'adjective', meaning: 'Full of many people.', example: 'The bus is crowded this morning.', quizOptions: ['Very quiet', 'Very expensive', 'Full of people'], quizAnswer: 2 },
  { word: 'affordable', type: 'adjective', meaning: 'Not too expensive; at a price you can pay.', example: 'This café has affordable food.', quizOptions: ['Not too expensive', 'Very far away', 'Difficult to find'], quizAnswer: 0 },
  { word: 'reservation', type: 'noun', meaning: 'An arrangement to keep a place for you.', example: 'I have a hotel reservation for tonight.', quizOptions: ['A printed ticket', 'An arrangement to keep a place', 'A late payment'], quizAnswer: 1 },
  { word: 'available', type: 'adjective', meaning: 'Free and ready to be used or chosen.', example: 'Is this seat available?', quizOptions: ['Broken', 'Already taken', 'Free to use'], quizAnswer: 2 },
  { word: 'confident', type: 'adjective', meaning: 'Feeling sure about your ability.', example: 'I feel more confident when I speak English.', quizOptions: ['Sure about yourself', 'Angry with someone', 'Tired after work'], quizAnswer: 0 },
  { word: 'improve', type: 'verb', meaning: 'To become better or make something better.', example: 'I practise every day to improve my English.', quizOptions: ['To stop completely', 'To become better', 'To make something slower'], quizAnswer: 1 },
  { word: 'opportunity', type: 'noun', meaning: 'A chance to do something useful or exciting.', example: 'Studying abroad is a great opportunity.', quizOptions: ['A problem', 'A long journey', 'A chance to do something'], quizAnswer: 2 },
] as const;

const GRAMMAR_QUESTIONS = [
  { prompt: 'She ___ English every evening.', options: ['study', 'studies', 'studying'], answer: 1, explanation: 'With he, she or it, add -s or -es to the Present Simple verb.' },
  { prompt: 'They ___ to university by bus.', options: ['go', 'goes', 'going'], answer: 0, explanation: 'Use the base verb with they, we and I.' },
  { prompt: '___ he work in a café?', options: ['Do', 'Does', 'Is'], answer: 1, explanation: 'Use Does to make a Present Simple question with he, she or it.' },
  { prompt: 'I ___ coffee in the evening.', options: ['doesn’t drink', 'not drink', 'don’t drink'], answer: 2, explanation: 'Use don’t + base verb with I, you, we and they.' },
  { prompt: 'My brother ___ football on Sundays.', options: ['plays', 'play', 'playing'], answer: 0, explanation: 'My brother means he, so the verb takes -s.' },
] as const;

const LISTENING_TRACKS = [
  {
    title: 'The missed bus',
    level: 'A2 · Everyday life',
    script: 'Hello, my name is Anna. I usually take the bus at eight o’clock. Today I missed it, so I am waiting for the next bus. I hope I am not late for class.',
    question: 'Why is Anna waiting?',
    options: ['She missed her bus.', 'She is meeting a friend.', 'She wants to buy a ticket.'],
    answer: 0,
    explanation: 'Anna says she missed the bus and is waiting for the next one.',
  },
  {
    title: 'A café order',
    level: 'A2 · Food and drink',
    script: 'Good afternoon. Could I have a medium cappuccino, please? I would also like a cheese sandwich. Is it possible to take them away? Thank you.',
    question: 'What size cappuccino does the customer order?',
    options: ['Small', 'Medium', 'Large'],
    answer: 1,
    explanation: 'The customer clearly asks for a medium cappuccino.',
  },
  {
    title: 'First day at university',
    level: 'A2 · Study',
    script: 'Hi, I am Daniel. Today is my first day at university. My class starts at nine, but I arrived early because I want to find the library and meet my classmates.',
    question: 'Why did Daniel arrive early?',
    options: ['He wants to go home.', 'He wants to find the library and meet classmates.', 'His class starts at seven.'],
    answer: 1,
    explanation: 'Daniel arrived early to find the library and meet his classmates.',
  },
] as const;

const SPEAKING_CHALLENGES = [
  { title: 'The 30-second story', prompt: 'Tell Emma about what you did yesterday. Use first, then, after that and finally.' },
  { title: 'Describe without naming', prompt: 'Describe your favourite food without saying its name. Explain its colour, taste and when you eat it.' },
  { title: 'Think fast', prompt: 'You have one minute to plan a perfect day in a new city. Tell Emma where you would go and why.' },
  { title: 'Ask the expert', prompt: 'Imagine Emma is visiting your city for the first time. Give her three useful tips and ask her one question.' },
] as const;

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

function AppButton({ title, onPress, icon, secondary = false, compact = false, disabled = false }: {
  title: string; onPress: () => void; icon?: IconName; secondary?: boolean; compact?: boolean; disabled?: boolean;
}) {
  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      pressedScale={compact ? 0.94 : 0.975}
      pressedOpacity={0.84}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        compact && styles.buttonCompact,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, compact && styles.buttonTextCompact]}>{title}</Text>
      {icon ? <Icon name={icon} size={18} color={secondary ? C.gold : '#2B180D'} /> : null}
    </AnimatedPressable>
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
      <AnimatedIconButton
        name="chevron-back"
        size={44}
        iconSize={21}
        accessibilityLabel="Go back"
        onPress={onBack}
        backgroundColor="#2B1B12"
      />
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
          {tabs.map((tab) => (
            <AnimatedTabItem
              key={tab.key}
              tab={tab.key}
              label={tab.title}
              selected={active === tab.key}
              onPress={onSelect}
              accessibilityLabel={`Navigate to ${tab.title} tab`}
              activeColor={C.gold}
              inactiveColor={C.dim}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function FeatureTile({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      pressedScale={0.955}
      pressedOpacity={0.88}
      style={styles.featureTile}
    >
      <View style={styles.featureIcon}><Icon name={icon} size={23} color={C.gold} /></View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureSubtitle}>{subtitle}</Text>
      <View style={styles.featureTileArrow}><Icon name="arrow-up-right" size={13} color={C.gold} /></View>
    </AnimatedPressable>
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
  const [learnerId, setLearnerId] = useState('');
  const [learnerReady, setLearnerReady] = useState(false);
  useEffect(() => {
    let active = true;
    void import('@react-native-async-storage/async-storage').then(async storage => {
      try {
        let id = await storage.default.getItem(LEARNER_ID_KEY);
        if (!id) {
          id = ('learner_' + Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 72);
          await storage.default.setItem(LEARNER_ID_KEY, id);
        }
        if (active) setLearnerId(id);
      } catch (error) {
        console.warn('Could not restore learner identity:', error);
        if (active) setLearnerApiError('Your learner profile could not be opened on this device.');
      } finally {
        if (active) setLearnerReady(true);
      }
    });
    return () => { active = false; };
  }, []);
  const [learnerApiError, setLearnerApiError] = useState('');
  const [learnerLevel, setLearnerLevel] = useState('A2');
  const [skillLevels, setSkillLevels] = useState<Record<string, string>>({
    chat: 'A2', scenarios: 'A2', vocabulary: 'A2', grammar: 'A2', listening: 'A2', speaking: 'A2',
  });
  const [skillProgress, setSkillProgress] = useState<Record<string, { level: string; mastery: number; attempts: number; accuracy: number; weakTopics: string[] }>>({});
  const [recentTopics, setRecentTopics] = useState<string[]>([]);
  const [generatedActivities, setGeneratedActivities] = useState<Record<string, any>>({});
  const [generatedAnswerChoices, setGeneratedAnswerChoices] = useState<Record<string, Record<number, number>>>({});
  const [generatedAnswerChecked, setGeneratedAnswerChecked] = useState<Record<string, boolean>>({});
  const [generatingSkill, setGeneratingSkill] = useState<string | null>(null);
  const [learningApiMessage, setLearningApiMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [recording, setRecording] = useState(false);

  const micPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!recording) {
      micPulse.stopAnimation();
      micPulse.setValue(0);
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [recording, micPulse]);
  const micPulseScale = micPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.24] });
  const micPulseOpacity = micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0] });

  const [chatSending, setChatSending] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [scenario, setScenario] = useState('Café Conversation');
  const [voiceSettingsVisible, setVoiceSettingsVisible] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({ speakingPace: 'natural' });
  const [voiceSettingsDraft, setVoiceSettingsDraft] = useState<VoiceSettings>({ speakingPace: 'natural' });
  const selectedCharacter = EMMA_CHARACTER;

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
  ]);
  const [savedWords, setSavedWords] = useState<string[]>(['usually', 'prefer']);
  const [learnFilter, setLearnFilter] = useState<'Grammar' | 'Listening' | 'Reading'>('Grammar');
  const [chatMode, setChatMode] = useState<'coach' | 'conversation' | 'challenge'>('coach');
  const [vocabularyMode, setVocabularyMode] = useState<'cards' | 'saved' | 'quiz'>('cards');
  const [vocabularyIndex, setVocabularyIndex] = useState(0);
  const [vocabularyRevealed, setVocabularyRevealed] = useState(false);
  const [vocabularyQuizChoice, setVocabularyQuizChoice] = useState<number | null>(null);
  const [vocabularyQuizChecked, setVocabularyQuizChecked] = useState(false);
  const [vocabularyQuizScore, setVocabularyQuizScore] = useState(0);
  const [grammarQuestionIndex, setGrammarQuestionIndex] = useState(0);
  const [grammarChoice, setGrammarChoice] = useState<number | null>(null);
  const [grammarChecked, setGrammarChecked] = useState(false);
  const [grammarScore, setGrammarScore] = useState(0);
  const [grammarFinished, setGrammarFinished] = useState(false);
  const [listeningIndex, setListeningIndex] = useState(0);
  const [listeningChoice, setListeningChoice] = useState<number | null>(null);
  const [listeningScore, setListeningScore] = useState(0);
  const [listeningFinished, setListeningFinished] = useState(false);
  const [listeningPlaying, setListeningPlaying] = useState(false);
  const [speakingChallengeIndex, setSpeakingChallengeIndex] = useState(0);
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

  const loadLearningProgress = useCallback(async () => {
    if (!learnerReady || !learnerId || !API_BASE_URL) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/progress/${learnerId}`);
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || 'Could not load progress.');
      const skills = data.progress?.skills || {};
      setSkillProgress(skills);
      const skillLevelMap = Object.fromEntries(Object.entries(skills).map(([skill, value]: [string, any]) => [skill, value.level]));
      setSkillLevels(current => ({ ...current, ...skillLevelMap }));
      setSavedWords(data.progress?.savedWords || []);
    } catch (error) {
      setLearningApiMessage(error instanceof Error ? error.message : 'Progress service is unavailable.');
    }
  }, [learnerReady, learnerId]);

  useEffect(() => {
    if (learnerReady && learnerId) void loadLearningProgress();
  }, [learnerReady, learnerId, loadLearningProgress]);

  const generateLearningActivity = useCallback(async (skill: string, goal?: string) => {
    if (!learnerReady || !learnerId) {
      setLearningApiMessage('Your learner profile is still loading. Please retry in a moment.');
      return null;
    }
    if (!API_BASE_URL) {
      setLearningApiMessage('Set EXPO_PUBLIC_API_URL to your deployed backend URL before generating AI lessons.');
      return null;
    }
    setGeneratingSkill(skill);
    setLearningApiMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill,
          studentLevel: skillLevels[skill] || learnerLevel,
          progress: skillProgress,
          recentTopics,
          learnerId,
          learnerGoal: goal || 'Build confident everyday English.',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true || !data.activity) {
        throw new Error(data.error || 'The AI could not create a lesson.');
      }
      setGeneratedActivities(current => ({ ...current, [skill]: data.activity }));
      if (typeof data.activity.title === 'string') {
        setRecentTopics(current => [data.activity.title, ...current].slice(0, 12));
      }
      return data.activity;
    } catch (error) {
      setLearningApiMessage(error instanceof Error ? error.message : 'AI lesson generation failed.');
      return null;
    } finally {
      setGeneratingSkill(null);
    }
  }, [learnerLevel, learnerReady, learnerId, skillLevels, skillProgress, recentTopics]);

  const submitLearningAttempt = useCallback(async (
    skill: string,
    topic: string,
    correct: number,
    total: number,
    level?: string,
  ) => {
    if (!learnerReady || !learnerId) {
      setLearningApiMessage('Your learner profile is still loading. Please retry the score submission.');
      return;
    }
    if (!API_BASE_URL) {
      setLearningApiMessage('Your attempt is not synced. Configure EXPO_PUBLIC_API_URL first.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/learning/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, skill, topic, correct, total, level: level || skillLevels[skill] || learnerLevel }),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || 'Could not save the attempt.');
      setSkillProgress(data.progress?.skills || {});
      const levelMap = Object.fromEntries(Object.entries(data.progress?.skills || {}).map(([name, value]: [string, any]) => [name, value.level]));
      setSkillLevels(current => ({ ...current, ...levelMap }));
    } catch (error) {
      setLearningApiMessage(error instanceof Error ? error.message : 'Attempt sync failed.');
    }
  }, [learnerReady, learnerId, learnerLevel, skillLevels]);

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
    setChatMode('coach');
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
          studentLevel: skillLevels.chat || learnerLevel,
          scenario,
          practiceMode: chatMode,
          learnerId,
          learnerProgress: skillProgress,
          scenarioContext: scenario === 'Free Conversation' ? null : {
            title: generatedActivities.scenarios?.title,
            context: generatedActivities.scenarios?.context,
            role: generatedActivities.scenarios?.role,
            goal: generatedActivities.scenarios?.goal,
            openingLine: generatedActivities.scenarios?.openingLine,
            usefulPhrases: generatedActivities.scenarios?.usefulPhrases,
          },
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
        'Voice settings saved',
        'The current conversation has stopped. Emma will use the updated speaking pace next time.',
      );
      return;
    }

    Alert.alert(
      'Voice settings saved',
      `Emma will use the ${voiceSettingsDraft.speakingPace} speaking pace in the next voice session.`,
    );
  };



  const startVoice = async () => {
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
        body: JSON.stringify({
          ...voiceSettings,
          speakingChallenge: generatedActivities.speaking?.mission || SPEAKING_CHALLENGES[speakingChallengeIndex].prompt,
          scenario,
          learnerId,
        }),
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
                text: tokenData.systemInstruction || EMMA_LIVE_PROMPT,
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
    if (screen !== 'listening') {
      void Speech.stop();
      setListeningPlaying(false);
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'voice' && (voiceStreamingRef.current || voiceStatus === 'connecting')) {
      void voiceStopRef.current();
    }
  }, [screen, voiceStatus]);

  useEffect(() => () => {
    void voiceStopRef.current();
  }, []);

  const toggleSaveWord = (word: string) => {
    const shouldSave = !savedWords.includes(word);
    setSavedWords(current => shouldSave ? [...current, word] : current.filter(item => item !== word));
    if (API_BASE_URL) {
      void fetch(`${API_BASE_URL}/api/learning/saved-words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, word, saved: shouldSave }),
      }).catch(error => console.warn('Saved word sync failed:', error));
    }
  };

  const openListening = () => {
    void Speech.stop();
    setListeningIndex(0);
    setListeningChoice(null);
    setListeningScore(0);
    setListeningFinished(false);
    setListeningPlaying(false);
    navigate('listening');
  };

  const playListeningTrack = () => {
    const track = LISTENING_TRACKS[listeningIndex];
    void Speech.stop();
    setListeningPlaying(true);
    Speech.speak(track.script, {
      language: 'en-US',
      rate: 0.82,
      pitch: 1,
      onDone: () => setListeningPlaying(false),
      onStopped: () => setListeningPlaying(false),
      onError: () => {
        setListeningPlaying(false);
        Alert.alert('Audio unavailable', 'Please check that an English text-to-speech voice is installed on your device.');
      },
    });
  };

  const checkGrammarAnswer = () => {
    if (grammarChoice === null || grammarChecked) return;
    setGrammarChecked(true);
    if (grammarChoice === GRAMMAR_QUESTIONS[grammarQuestionIndex].answer) {
      setGrammarScore(score => score + 1);
    }
  };

  const nextGrammarQuestion = () => {
    if (grammarQuestionIndex < GRAMMAR_QUESTIONS.length - 1) {
      setGrammarQuestionIndex(index => index + 1);
      setGrammarChoice(null);
      setGrammarChecked(false);
    } else {
      setGrammarFinished(true);
    }
  };

  const resetGrammarChallenge = () => {
    setGrammarQuestionIndex(0);
    setGrammarChoice(null);
    setGrammarChecked(false);
    setGrammarScore(0);
    setGrammarFinished(false);
  };

  const nextListeningTrack = () => {
    if (listeningIndex < LISTENING_TRACKS.length - 1) {
      setListeningIndex(index => index + 1);
      setListeningChoice(null);
      setListeningPlaying(false);
    } else {
      setListeningFinished(true);
    }
  };

  const restartListening = () => {
    void Speech.stop();
    setListeningIndex(0);
    setListeningChoice(null);
    setListeningScore(0);
    setListeningFinished(false);
    setListeningPlaying(false);
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
        <FeatureTile icon="headset-outline" title="Listening" subtitle="Train your ear" onPress={openListening} />
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
          <AppButton title={`Start ${learnFilter} lesson`} icon="arrow-forward" onPress={() => learnFilter === 'Listening' ? openListening() : openChat(`${learnFilter} Practice`)} />
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

  const renderAIActivityPanel = (skill: string, title: string, description: string) => {
    const activity = generatedActivities[skill];
    const isBusy = generatingSkill === skill;
    const questions = Array.isArray(activity?.questions) ? activity.questions : [];
    return (
      <View style={styles.challengePanel}>
        <Text style={styles.cardKicker}>EMMA AI · {skill.toUpperCase()}</Text>
        <Text style={styles.challengeQuestion}>{activity?.title || title}</Text>
        <Text style={styles.mutedText}>{description}</Text>
        <Text style={styles.mutedText}>Level {skillLevels[skill] || learnerLevel} · Mastery {skillProgress[skill]?.mastery ?? 0}% · {skillProgress[skill]?.attempts ?? 0} attempts</Text>
        {activity ? (
          <View style={{ marginTop: 14 }}>
            {activity.context ? <Text style={styles.wordMeaning}>{activity.context}</Text> : null}
            {activity.role ? <Text style={styles.wordMeaning}>Your role: {activity.role}</Text> : null}
            {activity.goal ? <Text style={styles.wordMeaning}>Goal: {activity.goal}</Text> : null}
            {activity.openingLine ? <Text style={styles.wordExampleText}>Emma: “{activity.openingLine}”</Text> : null}
            {activity.explanation ? <Text style={styles.wordMeaning}>{activity.explanation}</Text> : null}
            {activity.script ? (
              <>
                <Text style={styles.wordExampleLabel}>LISTENING SCRIPT</Text>
                <Text style={styles.wordExampleText}>{activity.script}</Text>
                <AppButton title="Play audio" icon="volume-high-outline" secondary onPress={() => Speech.speak(activity.script, { language: 'en-US', rate: 0.82 })} />
              </>
            ) : null}
            {Array.isArray(activity.usefulPhrases) ? activity.usefulPhrases.map((phrase: string, index: number) => <Text key={index} style={styles.wordExampleText}>• {phrase}</Text>) : null}
            {Array.isArray(activity.words) ? activity.words.map((word: any, index: number) => (
              <View key={index} style={styles.savedWordRow}>
                <View style={{ flex: 1 }}><Text style={styles.wordName}>{word.word}</Text><Text style={styles.wordMeaning}>{word.meaning}</Text><Text style={styles.wordExampleText}>{word.example}</Text></View>
                <Pressable style={styles.wordAction} onPress={() => Speech.speak(word.word, { language: 'en-US' })}><Icon name="volume-high-outline" color={C.gold} size={18} /></Pressable>
                <Pressable style={styles.wordAction} onPress={() => toggleSaveWord(word.word)}><Icon name={savedWords.includes(word.word) ? 'bookmark' : 'bookmark-outline'} color={C.gold} size={18} /></Pressable>
              </View>
            )) : null}
            {Array.isArray(activity.examples) ? activity.examples.map((example: string, index: number) => <Text key={index} style={styles.wordExampleText}>{example}</Text>) : null}
            {Array.isArray(activity.prompts) ? activity.prompts.map((prompt: string, index: number) => <Text key={index} style={styles.wordExampleText}>{index + 1}. {prompt}</Text>) : null}
            {Array.isArray(activity.successCriteria) ? activity.successCriteria.map((item: string, index: number) => <Text key={index} style={styles.tipText}>✓ {item}</Text>) : null}
            {questions.map((question: any, index: number) => (
              <View key={index} style={styles.savedWordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wordExampleLabel}>QUESTION {index + 1}</Text>
                  <Text style={styles.wordMeaning}>{question.prompt}</Text>
                  {Array.isArray(question.options) ? question.options.map((option: string, optionIndex: number) => {
                    const selected = generatedAnswerChoices[skill]?.[index] === optionIndex;
                    const checked = Boolean(generatedAnswerChecked[skill]);
                    const correct = checked && optionIndex === question.answerIndex;
                    return (
                      <AnimatedPressable key={optionIndex} disabled={checked} pressedScale={0.985} onPress={() => setGeneratedAnswerChoices(current => ({ ...current, [skill]: { ...(current[skill] || {}), [index]: optionIndex } }))} style={[styles.quizOption, selected && styles.quizOptionSelected, correct && styles.quizOptionCorrect]}>
                        <Text style={styles.quizOptionText}>{String.fromCharCode(65 + optionIndex)}. {option}</Text>
                        {correct ? <Icon name="checkmark-circle" color={C.green} size={18} /> : null}
                      </AnimatedPressable>
                    );
                  }) : null}
                  {generatedAnswerChecked[skill] ? <Text style={styles.tipText}>{generatedAnswerChoices[skill]?.[index] === question.answerIndex ? 'Correct.' : 'Not quite.'} {question.explanation}</Text> : null}
                </View>
              </View>
            ))}
            {questions.length > 0 ? (
              <AppButton title={generatedAnswerChecked[skill] ? 'Create another activity' : 'Check my answers'} icon="checkmark" disabled={!generatedAnswerChecked[skill] && questions.some((_: any, index: number) => generatedAnswerChoices[skill]?.[index] === undefined)} onPress={() => {
                if (generatedAnswerChecked[skill]) {
                  setGeneratedActivities(current => { const next = { ...current }; delete next[skill]; return next; });
                  setGeneratedAnswerChoices(current => { const next = { ...current }; delete next[skill]; return next; });
                  setGeneratedAnswerChecked(current => { const next = { ...current }; delete next[skill]; return next; });
                  void generateLearningActivity(skill);
                } else {
                  const score = questions.filter((question: any, index: number) => generatedAnswerChoices[skill]?.[index] === question.answerIndex).length;
                  setGeneratedAnswerChecked(current => ({ ...current, [skill]: true }));
                  void submitLearningAttempt(skill, activity.topic || activity.title || skill, score, questions.length, skillLevels[skill] || learnerLevel);
                }
              }} />
            ) : null}
            <Text style={styles.mutedText}>AI-generated lesson. Your score is recorded after checking the answers.</Text>
          </View>
        ) : null}
        <AppButton title={isBusy ? 'Emma is preparing your lesson…' : activity ? 'Refresh with a new lesson' : 'Generate a fresh AI lesson'} icon="sparkles" disabled={isBusy} onPress={() => {
          setGeneratedAnswerChoices(current => ({ ...current, [skill]: {} }));
          setGeneratedAnswerChecked(current => ({ ...current, [skill]: false }));
          void generateLearningActivity(skill);
        }} />
        {learningApiMessage ? <Text style={styles.tipText}>{learningApiMessage}</Text> : null}
      </View>
    );
  };

  const renderVocabulary = () => {
    const generated = generatedActivities.vocabulary;
    const words = Array.isArray(generated?.words) ? generated.words : [];
    const current = words[vocabularyIndex];
    const saved = words.filter((word: any) => savedWords.includes(word.word));
    return (
      <StaggeredScrollView {...scrollProps} animationKey={screen}>
        <ScreenHeader title="Vocabulary Lab" onBack={goBack} />
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>REMEMBER · RECALL · USE</Text>
          <Text style={styles.pageHeading}>Words that stay with you</Text>
          <Text style={styles.mutedText}>A personal word collection generated for your level.</Text>
        </View>
        <View style={styles.wordSummary}>
          <View><Text style={styles.wordSummaryNumber}>{words.length}</Text><Text style={styles.mutedText}>AI words</Text></View>
          <View style={styles.wordSummaryDivider} />
          <View><Text style={styles.wordSummaryNumber}>{savedWords.length}</Text><Text style={styles.mutedText}>Saved</Text></View>
          <View style={styles.wordSummaryDivider} />
          <View><Text style={styles.wordSummaryNumber}>{skillProgress.vocabulary?.mastery ?? 0}%</Text><Text style={styles.mutedText}>Mastery</Text></View>
        </View>
        <View style={styles.filterRow}>
          {(['cards', 'saved'] as const).map(mode => (
            <AnimatedPressable key={mode} onPress={() => setVocabularyMode(mode)} pressedScale={0.96} style={[styles.filterChip, vocabularyMode === mode && styles.filterChipActive]}>
              <Text style={[styles.filterText, vocabularyMode === mode && styles.filterTextActive]}>{mode === 'cards' ? 'AI words' : 'My words'}</Text>
            </AnimatedPressable>
          ))}
        </View>
        {current && vocabularyMode === 'cards' ? (
          <View style={styles.challengePanel}>
            <Text style={styles.cardKicker}>PERSONAL WORDS · {vocabularyIndex + 1}/{words.length}</Text>
            <AnimatedPressable onPress={() => setVocabularyRevealed(value => !value)} pressedScale={0.99} style={styles.flashcard}>
              <Text style={styles.flashcardWord}>{current.word}</Text>
              <Text style={styles.flashcardType}>{String(current.partOfSpeech || '').toUpperCase()}</Text>
              <Text style={styles.flashcardHint}>{vocabularyRevealed ? current.meaning : 'Tap to reveal meaning'}</Text>
              {vocabularyRevealed ? <View style={styles.wordExample}><Text style={styles.wordExampleLabel}>EXAMPLE</Text><Text style={styles.wordExampleText}>{current.example}</Text></View> : null}
            </AnimatedPressable>
            <View style={styles.challengeActionRow}>
              <AnimatedPressable accessibilityRole="button" style={styles.secondaryAction} onPress={() => Speech.speak(current.word, { language: 'en-US', rate: 0.82 })}><Icon name="volume-high-outline" color={C.gold} size={18} /><Text style={styles.secondaryActionText}>Listen</Text></AnimatedPressable>
              <AnimatedPressable accessibilityRole="button" style={styles.secondaryAction} onPress={() => toggleSaveWord(current.word)}><Icon name="bookmark-outline" color={C.gold} size={18} /><Text style={styles.secondaryActionText}>{savedWords.includes(current.word) ? 'Saved' : 'Save'}</Text></AnimatedPressable>
            </View>
            <View style={styles.challengeActionRow}>
              <AppButton title="Previous" secondary compact onPress={() => { setVocabularyIndex(index => Math.max(0, index - 1)); setVocabularyRevealed(false); }} disabled={vocabularyIndex === 0} />
              <AppButton title="Next word" compact icon="arrow-forward" onPress={() => { setVocabularyIndex(index => Math.min(words.length - 1, index + 1)); setVocabularyRevealed(false); }} disabled={vocabularyIndex >= words.length - 1} />
            </View>
          </View>
        ) : vocabularyMode === 'saved' ? (
          <View style={styles.challengePanel}>
            <Text style={styles.cardKicker}>YOUR WORD BANK</Text>
            {saved.length === 0 ? <Text style={styles.mutedText}>Save words from your AI lesson to build your vocabulary bank.</Text> : saved.map((word: any) => (
              <View key={word.word} style={styles.savedWordRow}>
                <View style={{ flex: 1 }}><Text style={styles.wordName}>{word.word}</Text><Text style={styles.wordMeaning}>{word.meaning}</Text><Text style={styles.wordExampleText}>{word.example}</Text></View>
                <Pressable style={styles.wordAction} onPress={() => Speech.speak(word.word, { language: 'en-US' })}><Icon name="volume-high-outline" color={C.gold} size={18} /></Pressable>
                <Pressable style={styles.wordAction} onPress={() => toggleSaveWord(word.word)}><Icon name="bookmark" color={C.gold} size={18} /></Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {renderAIActivityPanel('vocabulary', 'Your next word set', 'Emma generates fresh vocabulary and examples based on your level and weak areas.')}
      </StaggeredScrollView>
    );
  };

  const renderListening = () => {
    const activity = generatedActivities.listening;
    return (
      <StaggeredScrollView {...scrollProps} animationKey={screen}>
        <ScreenHeader title="Listening Lab" onBack={goBack} />
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>LISTEN · UNDERSTAND · RESPOND</Text>
          <Text style={styles.pageHeading}>Train your listening ear</Text>
          <Text style={styles.mutedText}>Fresh listening passages, generated for your current level.</Text>
        </View>
        {activity?.script ? (
          <View style={styles.challengePanel}>
            <Text style={styles.cardKicker}>AI LISTENING · {skillLevels.listening || learnerLevel}</Text>
            <Text style={styles.challengeQuestion}>{activity.title}</Text>
            <Text style={styles.wordExampleText}>{activity.script}</Text>
            <AppButton title={listeningPlaying ? 'Playing story…' : 'Play listening audio'} icon={listeningPlaying ? 'pause-circle-outline' : 'play-circle-outline'} secondary={listeningPlaying} onPress={() => {
              if (listeningPlaying) {
                void Speech.stop();
                setListeningPlaying(false);
                return;
              }
              void Speech.stop();
              setListeningPlaying(true);
              Speech.speak(activity.script, {
                language: 'en-US',
                rate: 0.86,
                onDone: () => setListeningPlaying(false),
                onStopped: () => setListeningPlaying(false),
                onError: () => setListeningPlaying(false),
              });
            }} />
          </View>
        ) : null}
        {renderAIActivityPanel('listening', 'A new story for your ears', 'Emma creates a new script and interactive comprehension questions. Text-to-speech reads the generated script aloud.')}
      </StaggeredScrollView>
    );
  };

  const renderLesson = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <ScreenHeader title="Scenarios" onBack={goBack} />
      <ImageBackground source={EMMA} imageStyle={styles.lessonImage} style={styles.lessonImageWrap}>
        <View style={styles.lessonImageShade} />
        <View style={styles.lessonImageContent}>
          <Text style={styles.cardKicker}>PRACTISE REAL LIFE</Text>
          <Text style={styles.lessonHeroTitle}>Step into a new conversation</Text>
          <Text style={styles.lessonHeroText}>Emma creates a fresh role-play for your goal and CEFR level.</Text>
        </View>
      </ImageBackground>
      {renderAIActivityPanel('scenarios', 'Your next real-life scene', 'Generate a role, goal, opening line and useful phrases. Then practise it in Emma Chat.')}
      <AppButton title="Start this role-play with Emma" icon="chatbubble-ellipses-outline" disabled={!generatedActivities.scenarios} onPress={() => openChat('Free Conversation')} />
    </StaggeredScrollView>
  );

  const renderChat = () => (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      <View style={styles.chatHeader}>
        <Pressable onPress={goBack} style={styles.backButton}><Icon name="chevron-back" size={22} /></Pressable>
        <Avatar size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.chatHeaderTitle}>Emma <Text style={styles.chatHeaderAI}>(AI Tutor)</Text></Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online · {scenario} · {chatMode === 'coach' ? 'Gentle corrections' : chatMode === 'challenge' ? 'Challenge mode' : 'Free conversation'}</Text>
          </View>
        </View>
        <AnimatedIconButton name="call-outline" size={42} iconSize={19} accessibilityLabel="Start voice practice with Emma" onPress={() => navigate('voice')} />
        <AnimatedIconButton name="ellipsis-vertical" size={42} iconSize={18} tone="cream" accessibilityLabel="Conversation options" onPress={() => Alert.alert('Conversation', 'Your practice conversation is saved in this demo session.')} />
      </View>

      <View style={styles.chatModeRow}>
        {([
          ['coach', 'Coach me'],
          ['conversation', 'Free talk'],
          ['challenge', 'Challenge'],
        ] as const).map(([mode, label]) => (
          <AnimatedPressable key={mode} onPress={() => setChatMode(mode)} pressedScale={0.95} style={[styles.chatModeChip, chatMode === mode && styles.chatModeChipActive]}>
            <Text style={[styles.chatModeText, chatMode === mode && styles.chatModeTextActive]}>{label}</Text>
          </AnimatedPressable>
        ))}
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
          <AnimatedPressable key={item} onPress={() => setChatInput(item)} pressedScale={0.95} style={styles.quickReply}>
            <Text style={styles.quickReplyText}>{item}</Text>
          </AnimatedPressable>
        ))}
      </View>

      <View style={styles.composerWrap}>
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Open vocabulary" style={styles.composerAdd} onPress={() => navigate('vocabulary')}><Icon name="add" size={23} color={C.gold} /></AnimatedPressable>
        <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Type in English..." placeholderTextColor={C.dim} style={styles.composerInput} returnKeyType="send" onSubmitEditing={sendMessage} />
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Open speaking practice" style={styles.composerMic} onPress={() => navigate('voice')}><Icon name="mic" size={21} color="#2B180D" /></AnimatedPressable>
        <AnimatedPressable
          style={[styles.sendButton, chatSending && { opacity: 0.55 }]}
          onPress={sendMessage}
          disabled={chatSending || !chatInput.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message to Emma"
          accessibilityState={{ disabled: chatSending || !chatInput.trim() }}
          pressedScale={0.9}
        >
          <Icon name="send" size={18} color="#2B180D" />
        </AnimatedPressable>
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
        <Text style={styles.voiceStep}>Speak naturally with Emma</Text>
        <Text style={styles.voiceHint}>{generatedActivities.speaking?.mission || SPEAKING_CHALLENGES[speakingChallengeIndex].prompt}</Text>
        <AnimatedPressable onPress={() => setSpeakingChallengeIndex(index => (index + 1) % SPEAKING_CHALLENGES.length)} pressedScale={0.96} style={styles.speakingMissionButton} accessibilityRole="button">
          <Icon name="shuffle-outline" size={15} color={selectedCharacter.accent} />
          <Text style={styles.speakingMissionText}>Change speaking mission</Text>
        </AnimatedPressable>
        <ProgressBar progress={60} color={selectedCharacter.accent} />
        <View style={{ marginTop: 12 }}>
          <AppButton title={generatingSkill === 'speaking' ? 'Emma is preparing…' : 'Generate a new AI speaking mission'} icon="sparkles" secondary disabled={generatingSkill === 'speaking'} onPress={() => { void generateLearningActivity('speaking'); }} />
        </View>
        {Array.isArray(generatedActivities.speaking?.prompts) ? generatedActivities.speaking.prompts.map((prompt: string, index: number) => <Text key={index} style={styles.voiceHint}>{index + 1}. {prompt}</Text>) : null}
        <Text style={styles.mutedText}>Speaking level {skillLevels.speaking || learnerLevel} · mastery {skillProgress.speaking?.mastery ?? 0}%</Text>
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
        <AnimatedIconButton
          name="keypad-outline"
          iconSize={22}
          size={48}
          tone="cream"
          accessibilityLabel="Return to text chat"
          onPress={() => navigate('chat')}
        />

        <View style={styles.liveMicControl}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.liveMicHalo,
              {
                borderColor: recording ? C.green : selectedCharacter.accent,
                opacity: micPulseOpacity,
                transform: [{ scale: micPulseScale }],
              },
            ]}
          />
          <AnimatedPressable
            onPress={recording ? stopVoice : startVoice}
            disabled={voiceStatus === 'connecting'}
            pressedScale={0.91}
            pressedOpacity={0.8}
            style={[
              styles.voiceMicButton,
              { backgroundColor: recording ? C.green : selectedCharacter.accent, borderColor: selectedCharacter.surface, shadowColor: selectedCharacter.accent },
              voiceStatus === 'connecting' && { opacity: 0.65 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={recording ? 'End voice conversation' : `Start ${selectedCharacter.name} voice conversation`}
            accessibilityState={{ disabled: voiceStatus === 'connecting', selected: recording }}
          >
            <Icon name={recording ? 'stop' : 'mic'} size={34} color="#2B180D" />
          </AnimatedPressable>
        </View>

        <AnimatedIconButton
          name="options-outline"
          iconSize={22}
          size={48}
          tone="cream"
          accessibilityLabel="Open Emma voice settings"
          onPress={openVoiceSettings}
        />
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

  const renderGrammar = () => (
    <StaggeredScrollView {...scrollProps} animationKey={screen}>
      <ScreenHeader title="Grammar Detective" onBack={goBack} />
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>DISCOVER · PRACTISE · MASTER</Text>
        <Text style={styles.pageHeading}>Grammar that moves with you</Text>
        <Text style={styles.mutedText}>Emma finds your weak points and creates new lessons at your level.</Text>
      </View>
      {renderAIActivityPanel('grammar', 'Your next grammar case', 'Generate a fresh explanation, examples and interactive questions.')}
      <View style={styles.challengePanel}>
        <Text style={styles.cardKicker}>YOUR GRAMMAR PROGRESS</Text>
        <Text style={styles.challengeQuestion}>{skillLevels.grammar || learnerLevel}</Text>
        <Text style={styles.mutedText}>Mastery: {skillProgress.grammar?.mastery ?? 0}% · Attempts: {skillProgress.grammar?.attempts ?? 0}</Text>
        <ProgressBar progress={skillProgress.grammar?.mastery ?? 0} />
      </View>
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
      case 'grammar': return renderGrammar();
      case 'chat': return renderChat();
      case 'voice': return renderVoice();
      case 'correction': return renderGrammar();
      case 'listening': return renderListening();
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
            accessibilityLabel="Close Emma voice settings"
          />
          <View style={[styles.voiceSettingsSheet, { paddingBottom: Math.max(insets.bottom, 18), borderColor: EMMA_CHARACTER.accent }]}>
            <View style={styles.voiceSettingsHandle} />
            <View style={styles.voiceSettingsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.voiceSettingsTitle}>Emma's voice settings</Text>
                <Text style={styles.voiceSettingsSubtitle}>Adjust how Emma speaks during your English practice.</Text>
              </View>
              <Pressable
                style={styles.voiceSettingsClose}
                onPress={() => setVoiceSettingsVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close voice settings"
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
                  <Icon name="speedometer-outline" size={18} color={EMMA_CHARACTER.accent} />
                  <Text style={[styles.voiceSettingsSectionTitle, { color: EMMA_CHARACTER.accent }]}>SPEAKING PACE</Text>
                </View>
                <View style={styles.voicePaceRow}>
                  {PACE_OPTIONS.map(option => {
                    const selected = voiceSettingsDraft.speakingPace === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.voicePaceOption, selected && { borderColor: EMMA_CHARACTER.accent, backgroundColor: EMMA_CHARACTER.surface }]}
                        onPress={() => setVoiceSettingsDraft(current => ({ ...current, speakingPace: option.value }))}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.voicePaceTitle, selected && { color: EMMA_CHARACTER.accent }]}>{option.title}</Text>
                        <Text style={styles.voicePaceDescription}>{option.description}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.voiceSettingsFootnote}>Pace changes how Emma delivers her responses. It does not change the recorded audio playback speed.</Text>
              </View>

              <View style={styles.voiceSettingsInfo}>
                <Icon name="information-circle-outline" size={18} color={EMMA_CHARACTER.accent} />
                <Text style={styles.voiceSettingsInfoText}>Emma is your English tutor and the only speaking partner in this app. Her Gemini voice is Achernar.</Text>
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.voiceSettingsSave, { backgroundColor: EMMA_CHARACTER.accent }, pressed && styles.pressed]}
              onPress={applyVoiceSettings}
              accessibilityRole="button"
              accessibilityLabel="Save Emma voice settings"
            >
              <Text style={styles.voiceSettingsSaveText}>Save voice settings</Text>
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
  featureTile: { width: '31.5%', backgroundColor: C.card, borderWidth: 1, borderColor: '#4C3222', borderRadius: 16, minHeight: 111, paddingTop: 13, paddingBottom: 12, paddingHorizontal: 7, alignItems: 'center', marginBottom: 9, position: 'relative', overflow: 'hidden' },
  featureTileArrow: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(244,184,110,0.09)', alignItems: 'center', justifyContent: 'center' },
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

  chatModeRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#3D2A1D' },
  chatModeChip: { borderWidth: 1, borderColor: C.line, borderRadius: 15, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.card },
  chatModeChipActive: { borderColor: C.gold, backgroundColor: '#4A301D' },
  chatModeText: { color: C.muted, fontSize: 9, fontWeight: '700' },
  chatModeTextActive: { color: C.gold },
  challengePanel: { backgroundColor: C.card, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 16, gap: 10 },
  challengeQuestion: { color: C.white, fontSize: 18, lineHeight: 25, fontWeight: '800', marginTop: 6, marginBottom: 7 },
  quizOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 13, borderWidth: 1, borderColor: '#62432F', backgroundColor: '#342216', marginBottom: 8 },
  quizOptionSelected: { borderColor: C.gold, backgroundColor: '#4A301D' },
  quizOptionCorrect: { borderColor: C.green, backgroundColor: '#23382A' },
  quizOptionText: { color: C.cream, fontSize: 12, lineHeight: 17, flex: 1 },
  challengeActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, marginTop: 8 },
  secondaryAction: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: '#3A2718', paddingHorizontal: 8 },
  secondaryActionText: { color: C.gold, fontSize: 10, fontWeight: '800' },
  flashcard: { minHeight: 190, justifyContent: 'center', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: '#725033', backgroundColor: '#3C281A', padding: 19, marginVertical: 6 },
  flashcardWord: { color: C.white, fontSize: 31, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  flashcardType: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 8 },
  flashcardHint: { color: C.cream, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
  savedWordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#4A3324' },
  audioPlayButton: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: C.gold, marginTop: 12, marginBottom: 10 },
  audioPlayTitle: { color: '#2B180D', fontSize: 13, fontWeight: '900' },
  audioPlaySubtitle: { color: '#654222', fontSize: 9, marginTop: 3 },
  speakingMissionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#4A301D', marginBottom: 8 },
  speakingMissionText: { color: C.gold, fontSize: 9, fontWeight: '800' },
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
  liveMicControl: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  liveMicHalo: { position: 'absolute', width: 82, height: 82, borderRadius: 41, borderWidth: 2 },
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