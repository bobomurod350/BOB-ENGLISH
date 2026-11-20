import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, BackHandler, Image, ImageBackground, Keyboard, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';

type IconName = string;
type Screen = 'welcome' | 'home' | 'practice' | 'learn' | 'progress' | 'profile' | 'chat' | 'voice' | 'vocabulary' | 'correction' | 'lesson';
type Tab = 'home' | 'practice' | 'learn' | 'progress' | 'profile';
type ChatMessage = { id: number; from: 'emma' | 'you'; text: string; time: string };

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

function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.screenHeader}>
      <Pressable onPress={onBack} style={styles.backButton}><Icon name="chevron-back" size={22} /></Pressable>
      <Text style={styles.screenTitle}>{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

function Avatar({ size = 42 }: { size?: number }) {
  return <Image source={EMMA} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: C.gold }} />;
}

function BottomTabs({ active, onSelect, bottomInset = 0 }: { active: Tab; onSelect: (tab: Tab) => void; bottomInset?: number }) {
  const tabs: { key: Tab; title: string; icon: IconName }[] = [
    { key: 'home', title: 'Home', icon: 'home-outline' },
    { key: 'practice', title: 'Practice', icon: 'headset-outline' },
    { key: 'learn', title: 'Learn', icon: 'book-outline' },
    { key: 'progress', title: 'Progress', icon: 'stats-chart-outline' },
    { key: 'profile', title: 'Profile', icon: 'person-outline' },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onSelect(tab.key)} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
            <View style={[styles.tabIconWrap, selected && styles.tabIconWrapActive]}>
              <Icon name={tab.icon} size={20} color={selected ? C.gold : C.dim} />
            </View>
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.title}</Text>
          </Pressable>
        );
      })}
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


function AppContent() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compactWidth = windowWidth < 360;
  const shortScreen = windowHeight < 700;
  const [screen, setScreen] = useState<Screen>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const screenRef = useRef<Screen>('welcome');
  const historyRef = useRef<Screen[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [scenario, setScenario] = useState('Café Conversation');
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
      // Keep the highlighted tab in sync, even when the screen is already visible.
      setActiveTab(next as Tab);
    }
    if (current === next) return;

    if (isDestinationMainTab) {
      // Opening a primary tab is equivalent to selecting it from the tab bar.
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
    contentContainerStyle: [styles.scrollContent, { paddingHorizontal: compactWidth ? 15 : Math.min(24, Math.max(18, windowWidth * 0.05)), paddingBottom: 28 }],
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
    setChatMessages([{ id: Date.now(), from: 'emma', text: nextScenario === 'Café Conversation' ? "Hi! I'm Emma. I work at this café. I love meeting new people. What would you like to drink today?" : `Hi! I'm Emma. Today we're practising: ${nextScenario.toLowerCase()}. I'll speak first, and you can answer me in English. Ready?`, time: 'Now' }]);
    navigate('chat');
  };

  const localReply = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('coffee') || lower.includes('tea')) return "Nice choice! I usually drink a latte, but sometimes I prefer green tea. Why do you like that drink?";
    if (lower.includes('football') || lower.includes('soccer')) return "That's interesting! I enjoy watching football with my friends. Which team do you support?";
    if (lower.includes('hello') || lower.includes('hi')) return "Hello again! I'm happy you're practising with me. Tell me one thing about your day.";
    if (lower.includes('thank')) return "You're very welcome! I enjoy our conversations. Can you ask me a question now?";
    return "I see! I'd love to hear more. Can you tell me one more detail? Remember, speak naturally — mistakes are part of learning.";
  };

  const sendMessage = () => {
    const message = chatInput.trim();
    if (!message) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setChatMessages(current => [...current, { id: Date.now(), from: 'you', text: message, time }]);
    setChatInput('');
    Keyboard.dismiss();
    setTimeout(() => setChatMessages(current => [...current, { id: Date.now() + 1, from: 'emma', text: localReply(message), time }]), 550);
  };

  const toggleSaveWord = (word: string) => {
    setSavedWords(words => words.includes(word) ? words.filter(item => item !== word) : [...words, word]);
  };

  const renderWelcome = () => (
    <ImageBackground source={EMMA} resizeMode="cover" style={styles.welcomeBackground}>
      <View style={styles.welcomeOverlay} />
      <ScrollView contentContainerStyle={[styles.welcomeContent, { paddingTop: 24, paddingBottom: Math.max(28, insets.bottom + 24) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.brandMark}><Icon name="pulse" size={34} color={C.gold} /></View>
        <Text style={styles.brandTitle}>BOB <Text style={{ color: C.gold }}>ENGLISH</Text></Text>
        <Text style={styles.brandSubtitle}>Your personal AI English tutor</Text>
        <View style={styles.welcomePoints}>
          {['Talk naturally with AI', 'Real-life conversations', 'Get corrections and tips', 'Build vocabulary & grammar', 'Improve your pronunciation'].map(item => <View key={item} style={styles.welcomePoint}><Icon name="checkmark-circle" size={18} color={C.gold} /><Text style={styles.welcomePointText}>{item}</Text></View>)}
        </View>
        <AppButton title="Start Learning" icon="arrow-forward" onPress={() => { historyRef.current = []; setActiveTab('home'); screenRef.current = 'home'; setScreen('home'); }} />
        <Text style={styles.welcomeFooter}>A little English every day makes a big difference.</Text>
      </ScrollView>
    </ImageBackground>
  );

  const renderHome = () => (
    <ScrollView {...scrollProps}>
      <View style={styles.homeTop}>
        <View style={styles.greetingBlock}>
          <Text style={styles.eyebrow}>YOUR DAILY ENGLISH ROUTINE</Text>
          <Text style={styles.greeting}>Hi there! <Text style={{ color: C.gold }}>✦</Text></Text>
          <Text style={styles.mutedText}>Ready to practise English?</Text>
        </View>
        <Pressable onPress={() => navigate('profile')} style={styles.streakPill}><Icon name="flame" size={16} color={C.gold} /><Text style={styles.streakText}>7 days</Text></Pressable>
      </View>
      <Pressable onPress={() => navigate('lesson')} style={styles.continueCard}>
        <ImageBackground source={EMMA} imageStyle={styles.continueImage} style={styles.continueImageWrap}>
          <View style={styles.continueShade} />
          <View style={styles.continueContent}>
            <Text style={styles.cardKicker}>CONTINUE YOUR JOURNEY</Text>
            <Text style={styles.continueTitle}>Café Conversation</Text>
            <Text style={styles.continueMeta}>Lesson 3 of 5</Text>
            <ProgressBar progress={60} />
            <View style={styles.continueBottom}><Text style={styles.continueMeta}>3 / 5 steps completed</Text><View style={styles.playCircle}><Icon name="play" size={18} color="#2B180D" /></View></View>
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
        <View style={styles.goalCopy}><Text style={styles.goalTitle}>Today's Goal</Text><Text style={styles.goalText}>Have a 5-minute conversation in English</Text><ProgressBar progress={60} color={C.green} /></View>
        <View style={styles.goalPercent}><Text style={styles.goalPercentText}>60%</Text></View>
      </Pressable>
      <SectionTitle title="Try a real conversation" action="See all" onAction={() => navigate('practice')} />
      <View style={styles.inlineScenarios}>
        <ScenarioCard icon="cafe-outline" title="At a café" detail="Order a drink and chat" onPress={() => openChat('Café Conversation')} />
        <ScenarioCard icon="airplane-outline" title="At the airport" detail="Check in and ask questions" onPress={() => openChat('Airport Travel')} />
      </View>
    </ScrollView>
  );

  const renderPractice = () => (
    <ScrollView {...scrollProps}>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>SPEAK WITH CONFIDENCE</Text><Text style={styles.pageHeading}>Real-life scenarios</Text><Text style={styles.mutedText}>Practise the English you'll use in everyday life.</Text></View>
      <View style={styles.practiceBanner}><View><Text style={styles.cardKicker}>TODAY'S CHALLENGE</Text><Text style={styles.bannerTitle}>Speak for 5 minutes</Text><Text style={styles.bannerDetail}>Pick a situation and start talking with Emma.</Text></View><View style={styles.bannerIcon}><Icon name="mic" size={30} color={C.gold} /></View></View>
      <SectionTitle title="Choose a situation" />
      <ScenarioCard icon="cafe-outline" title="Café Conversation" detail="Order a drink, make small talk and share preferences." onPress={() => openChat('Café Conversation')} />
      <ScenarioCard icon="airplane-outline" title="At the Airport" detail="Check in, ask about your flight and find your gate." onPress={() => openChat('Airport Travel')} />
      <ScenarioCard icon="briefcase-outline" title="Job Interview" detail="Introduce yourself and answer common questions." onPress={() => openChat('Job Interview')} />
      <ScenarioCard icon="bed-outline" title="At the Hotel" detail="Book a room and ask for help at reception." onPress={() => openChat('Hotel Check-in')} />
      <ScenarioCard icon="school-outline" title="At the University" detail="Meet new people and talk about your studies." onPress={() => openChat('University Life')} />
      <ScenarioCard icon="restaurant-outline" title="At a Restaurant" detail="Read a menu, order food and ask for the bill." onPress={() => openChat('Restaurant Conversation')} />
      <View style={styles.tipCard}><Icon name="bulb-outline" size={20} color={C.gold} /><Text style={styles.tipText}>Tip: Don't worry about making mistakes. Emma will help you say it more naturally.</Text></View>
    </ScrollView>
  );

  const renderLearn = () => (
    <ScrollView {...scrollProps}>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>LEARN STEP BY STEP</Text><Text style={styles.pageHeading}>Your learning path</Text><Text style={styles.mutedText}>Short lessons that help you speak more naturally.</Text></View>
      <View style={styles.levelCard}><View style={styles.levelCircle}><Text style={styles.levelText}>A2</Text><Text style={styles.levelSub}>ELEMENTARY</Text></View><View style={styles.levelInfo}><Text style={styles.levelTitle}>You're making progress</Text><Text style={styles.mutedText}>9 of 16 lessons completed</Text><ProgressBar progress={56} /><Text style={styles.levelHint}>Next milestone: B1 Intermediate</Text></View></View>
      <View style={styles.filterRow}>{(['Grammar', 'Listening', 'Reading'] as const).map((filter) => <Pressable key={filter} onPress={() => setLearnFilter(filter)} style={[styles.filterChip, learnFilter === filter && styles.filterChipActive]}><Text style={[styles.filterText, learnFilter === filter && styles.filterTextActive]}>{filter}</Text></Pressable>)}</View>
      {learnFilter === 'Grammar' ? (
        <>
          <View style={styles.lessonFeature}><View style={styles.lessonFeatureIcon}><Icon name="book-open-outline" size={28} color={C.gold} /></View><View style={{ flex: 1 }}><Text style={styles.cardKicker}>GRAMMAR FOCUS</Text><Text style={styles.lessonFeatureTitle}>Present Simple</Text><Text style={styles.lessonFeatureDetail}>For habits, routines and general truths.</Text></View><Icon name="chevron-forward" size={20} color={C.gold} /></View>
          <SectionTitle title="Lesson outline" />
          {['What is the Present Simple?', 'How to use it', 'Positive and negative sentences', 'Questions and short answers', 'Practice with Emma'].map((item, i) => <Pressable key={item} onPress={() => i === 4 ? openChat('Present Simple Practice') : navigate('correction')} style={styles.outlineRow}><View style={styles.outlineNumber}><Text style={styles.outlineNumberText}>{i + 1}</Text></View><Text style={styles.outlineText}>{item}</Text><Icon name="chevron-forward" size={18} color={C.dim} /></Pressable>)}
        </>
      ) : (
        <>
          <View style={styles.lessonFeature}><View style={styles.lessonFeatureIcon}><Icon name={learnFilter === 'Listening' ? 'headset-outline' : 'newspaper-outline'} size={28} color={C.gold} /></View><View style={{ flex: 1 }}><Text style={styles.cardKicker}>{learnFilter.toUpperCase()} PRACTICE</Text><Text style={styles.lessonFeatureTitle}>{learnFilter === 'Listening' ? 'A morning at the café' : 'A day in my life'}</Text><Text style={styles.lessonFeatureDetail}>{learnFilter === 'Listening' ? 'Listen to Emma and understand a natural conversation.' : 'Read a short first-person story and learn useful phrases.'}</Text></View></View>
          <AppButton title={`Start ${learnFilter} lesson`} icon="arrow-forward" onPress={() => openChat(`${learnFilter} Practice`)} />
        </>
      )}
      <SectionTitle title="More lessons" />
      <ScenarioCard icon="chatbubble-outline" title="Introduce Yourself" detail="Talk about your name, work and interests." onPress={() => openChat('Introducing Yourself')} />
      <ScenarioCard icon="calendar-outline" title="My Daily Routine" detail="Describe your everyday activities." onPress={() => openChat('Daily Routine')} />
    </ScrollView>
  );

  const renderProgress = () => (
    <ScrollView {...scrollProps}>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR ACHIEVEMENTS</Text><Text style={styles.pageHeading}>My progress</Text><Text style={styles.mutedText}>Every conversation makes you stronger.</Text></View>
      <View style={styles.progressHero}><View style={styles.bigLevel}><Text style={styles.bigLevelLabel}>A2</Text><Text style={styles.bigLevelSub}>Elementary</Text></View><View style={{ flex: 1 }}><Text style={styles.cardKicker}>CURRENT LEVEL</Text><Text style={styles.progressHeroTitle}>Keep going!</Text><Text style={styles.mutedText}>You're building a strong foundation.</Text><ProgressBar progress={72} color={C.green} /><Text style={styles.levelHint}>72% to your next level</Text></View></View>
      <View style={styles.statsGrid}>
        <StatCard icon="chatbubble-ellipses-outline" value="12" label="Conversations" />
        <StatCard icon="book-outline" value="320" label="New words" />
        <StatCard icon="mic-outline" value="87%" label="Speaking score" />
        <StatCard icon="flame-outline" value="7" label="Day streak" />
      </View>
      <SectionTitle title="Your skills" />
      {[['Speaking', 72], ['Listening', 85], ['Vocabulary', 78], ['Grammar', 64]].map(([label, value]) => <View key={String(label)} style={styles.skillRow}><View style={styles.skillTitleRow}><Text style={styles.skillName}>{label}</Text><Text style={styles.skillValue}>{value}%</Text></View><ProgressBar progress={Number(value)} color={C.gold} /></View>)}
      <View style={styles.weekCard}><Text style={styles.goalTitle}>Weekly activity</Text><Text style={styles.mutedText}>You practised 5 days this week.</Text><View style={styles.weekBars}>{[35, 60, 48, 78, 88, 100, 54].map((height, index) => <View key={index} style={styles.weekBarColumn}><View style={[styles.weekBar, { height: height * 0.62 }]} /><Text style={styles.weekDay}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text></View>)}</View></View>
    </ScrollView>
  );

  function StatCard({ icon, value, label }: { icon: IconName; value: string; label: string }) {
    return <View style={styles.statCard}><Icon name={icon} size={22} color={C.gold} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
  }

  const renderProfile = () => (
    <ScrollView {...scrollProps}>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR PERSONAL SPACE</Text><Text style={styles.pageHeading}>My profile</Text></View>
      <View style={styles.profileHero}><View style={styles.profileAvatar}><Icon name="person" size={34} color={C.gold} /></View><Text style={styles.profileName}>English Learner</Text><Text style={styles.mutedText}>A2 · Elementary</Text><View style={styles.memberPill}><Icon name="ribbon-outline" color={C.gold} size={15} /><Text style={styles.memberPillText}>7-day learning streak</Text></View></View>
      <SectionTitle title="Learning preferences" />
      <ProfileRow icon="language-outline" title="Learning language" value="English" />
      <ProfileRow icon="bar-chart-outline" title="My level" value="A2 · Elementary" />
      <ProfileRow icon="notifications-outline" title="Daily reminders" value="On" />
      <ProfileRow icon="bookmark-outline" title="Saved vocabulary" value={`${savedWords.length} words`} onPress={() => navigate('vocabulary')} />
      <ProfileRow icon="settings-outline" title="Settings" value="Personalise your app" onPress={() => Alert.alert('Settings', 'More settings will be added in the next build.')} />
      <View style={styles.tipCard}><Icon name="heart-outline" size={20} color={C.gold} /><Text style={styles.tipText}>Your goal is progress, not perfection. Keep speaking!</Text></View>
    </ScrollView>
  );

  function ProfileRow({ icon, title, value, onPress }: { icon: IconName; title: string; value: string; onPress?: () => void }) {
    return <Pressable onPress={onPress} style={styles.profileRow}><View style={styles.profileRowIcon}><Icon name={icon} size={20} color={C.gold} /></View><View style={{ flex: 1 }}><Text style={styles.profileRowTitle}>{title}</Text><Text style={styles.profileRowValue}>{value}</Text></View><Icon name="chevron-forward" size={18} color={C.dim} /></Pressable>;
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
      <ScrollView {...scrollProps}>
        <ScreenHeader title="Vocabulary" onBack={goBack} right={<Icon name="search-outline" size={21} color={C.cream} />} />
        <View style={styles.pageIntro}><Text style={styles.eyebrow}>WORDS FROM YOUR JOURNEY</Text><Text style={styles.pageHeading}>Build your vocabulary</Text><Text style={styles.mutedText}>Listen, learn and save useful words.</Text></View>
        <View style={styles.wordSummary}><View><Text style={styles.wordSummaryNumber}>320</Text><Text style={styles.mutedText}>Words learned</Text></View><View style={styles.wordSummaryDivider} /><View><Text style={styles.wordSummaryNumber}>{savedWords.length}</Text><Text style={styles.mutedText}>Saved words</Text></View><View style={styles.wordSummaryDivider} /><View><Text style={styles.wordSummaryNumber}>24</Text><Text style={styles.mutedText}>To review</Text></View></View>
        {words.map((item) => <View key={item.word} style={styles.wordCard}><View style={styles.wordTop}><View style={{ flex: 1 }}><Text style={styles.wordName}>{item.word}</Text><Text style={styles.wordType}>{item.type}</Text></View><Pressable onPress={() => toggleSaveWord(item.word)} style={styles.wordAction}><Icon name={savedWords.includes(item.word) ? 'bookmark' : 'bookmark-outline'} size={20} color={C.gold} /></Pressable></View><Text style={styles.wordMeaning}>{item.meaning}</Text><View style={styles.wordExample}><Text style={styles.wordExampleLabel}>EXAMPLE</Text><Text style={styles.wordExampleText}>{item.example}</Text></View></View>)}
      </ScrollView>
    );
  };

  const renderChat = () => (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      <View style={styles.chatHeader}>
        <Pressable onPress={goBack} style={styles.backButton}><Icon name="chevron-back" size={22} /></Pressable>
        <Avatar size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.chatHeaderTitle}>Emma <Text style={styles.chatHeaderAI}>(AI Tutor)</Text></Text><View style={styles.onlineRow}><View style={styles.onlineDot} /><Text style={styles.onlineText}>Online · {scenario}</Text></View></View>
        <Pressable style={styles.chatHeaderAction} onPress={() => navigate('voice')}><Icon name="call-outline" size={21} color={C.gold} /></Pressable>
        <Pressable style={styles.chatHeaderAction} onPress={() => Alert.alert('Conversation', 'Your practice conversation is saved in this demo session.')}><Icon name="ellipsis-vertical" size={19} color={C.cream} /></Pressable>
      </View>
      <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatMessages} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Image source={EMMA} style={styles.chatHeroImage} />
        <View style={styles.chatWelcomePill}><View style={styles.onlineDot} /><Text style={styles.chatWelcomeText}>Emma · Your English speaking partner</Text></View>
        {chatMessages.map((message) => <View key={message.id} style={[styles.messageRow, message.from === 'you' && styles.messageRowYou]}>
          {message.from === 'emma' ? <Avatar size={30} /> : null}
          <View style={[styles.messageBubble, message.from === 'you' ? styles.messageBubbleYou : styles.messageBubbleEmma]}>
            <Text style={[styles.messageText, message.from === 'you' && styles.messageTextYou]}>{message.text}</Text>
            <Text style={[styles.messageTime, message.from === 'you' && styles.messageTimeYou]}>{message.time}</Text>
          </View>
        </View>)}
      </ScrollView>
      <View style={styles.quickReplyRow}>
        {['Yes, I do.', 'Not really.', 'What about you?'].map((item) => <Pressable key={item} onPress={() => { setChatInput(item); }} style={styles.quickReply}><Text style={styles.quickReplyText}>{item}</Text></Pressable>)}
      </View>
      <View style={styles.composerWrap}>
        <Pressable style={styles.composerAdd} onPress={() => navigate('vocabulary')}><Icon name="add" size={23} color={C.gold} /></Pressable>
        <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Type in English..." placeholderTextColor={C.dim} style={styles.composerInput} returnKeyType="send" onSubmitEditing={sendMessage} />
        <Pressable style={styles.composerMic} onPress={() => navigate('voice')}><Icon name="mic" size={21} color="#2B180D" /></Pressable>
        <Pressable style={styles.sendButton} onPress={sendMessage}><Icon name="send" size={18} color="#2B180D" /></Pressable>
      </View>
      <View style={styles.demoNotice}><Icon name="information-circle-outline" size={14} color={C.dim} /><Text style={styles.demoNoticeText}>Preview conversation · AI connection comes next</Text></View>
    </KeyboardAvoidingView>
  );

  const renderVoice = () => (
    <View style={styles.voiceScreen}>
      <ScreenHeader title="Voice conversation" onBack={goBack} right={<Icon name="ellipsis-horizontal" size={20} color={C.cream} />} />
      <View style={styles.voiceProgress}><Text style={styles.cardKicker}>{scenario.toUpperCase()}</Text><Text style={styles.voiceStep}>Speak naturally with Emma</Text><ProgressBar progress={60} /></View>
      <View style={styles.voiceCenter}>
        <View style={[styles.voiceAvatarHalo, recording && styles.voiceAvatarHaloActive]}><Image source={EMMA} style={styles.voiceAvatar} /></View>
        <View style={styles.waveRow}>{Array.from({ length: 23 }).map((_, index) => <View key={index} style={[styles.waveBar, { height: 10 + ((index * 17) % 33), opacity: recording ? 1 : 0.5 }]} />)}</View>
        <Text style={styles.voiceStatus}>{recording ? 'Listening to you...' : "I'm listening when you're ready"}</Text>
        <Text style={styles.voiceHint}>{recording ? 'Tap the button to finish this practice turn.' : 'Tap the microphone and speak in English.'}</Text>
      </View>
      <View style={styles.voiceControls}>
        <Pressable style={styles.voiceSmallButton} onPress={() => Alert.alert('Keyboard input', 'Return to chat to type your answer.')}><Icon name="keypad-outline" size={22} color={C.cream} /></Pressable>
        <Pressable onPress={() => setRecording((value) => !value)} style={[styles.voiceMicButton, recording && styles.voiceMicButtonActive]}><Icon name={recording ? 'stop' : 'mic'} size={34} color="#2B180D" /></Pressable>
        <Pressable style={styles.voiceSmallButton} onPress={() => Alert.alert('Listening tip', 'Speak slowly and clearly. You can repeat a sentence as many times as you need.')}><Icon name="options-outline" size={22} color={C.cream} /></Pressable>
      </View>
      <View style={styles.demoNotice}><Icon name="information-circle-outline" size={14} color={C.dim} /><Text style={styles.demoNoticeText}>Microphone interface preview · Speech engine not connected yet</Text></View>
    </View>
  );

  const renderCorrection = () => (
    <ScrollView {...scrollProps}>
      <ScreenHeader title="Correction & tips" onBack={goBack} />
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>LEARN FROM YOUR MISTAKES</Text><Text style={styles.pageHeading}>Say it naturally</Text><Text style={styles.mutedText}>A small correction can make a big difference.</Text></View>
      <View style={styles.correctionCard}><View style={styles.correctionLabel}><Icon name="close-circle" size={18} color={C.red} /><Text style={styles.correctionLabelText}>YOUR SENTENCE</Text></View><Text style={styles.correctionSentence}>I usually drink coffee with milk.</Text><View style={styles.correctionDivider} /><View style={styles.correctionLabel}><Icon name="checkmark-circle" size={18} color={C.green} /><Text style={styles.correctionLabelText}>MORE NATURAL</Text></View><Text style={styles.correctedSentence}>I usually have a coffee with milk.</Text></View>
      <View style={styles.tipCard}><Icon name="bulb-outline" size={21} color={C.gold} /><View style={{ flex: 1 }}><Text style={styles.goalTitle}>Why?</Text><Text style={styles.tipText}>Both sentences are understandable. In everyday English, people often say “have a coffee” when they mean drinking one cup.</Text></View></View>
      <SectionTitle title="Useful grammar" />
      <View style={styles.grammarCard}><Text style={styles.lessonFeatureTitle}>Present Simple</Text><Text style={styles.mutedText}>Use it for habits, routines and facts.</Text><Text style={styles.grammarExample}>I drink coffee every morning.</Text><Text style={styles.grammarExample}>She works in a café.</Text><Text style={styles.grammarExample}>Do you like tea?</Text></View>
      <AppButton title="Practise with Emma" icon="arrow-forward" onPress={() => openChat('Grammar Practice')} />
    </ScrollView>
  );

  const renderLesson = () => (
    <ScrollView {...scrollProps}>
      <ScreenHeader title="Café conversation" onBack={goBack} />
      <ImageBackground source={EMMA} imageStyle={styles.lessonImage} style={styles.lessonImageWrap}><View style={styles.lessonImageShade} /><View style={styles.lessonImageContent}><Text style={styles.cardKicker}>A2 · ELEMENTARY</Text><Text style={styles.lessonHeroTitle}>Ordering at a café</Text><Text style={styles.lessonHeroText}>Learn how to order a drink and make friendly conversation.</Text></View></ImageBackground>
      <View style={styles.lessonProgressRow}><Text style={styles.goalTitle}>Your lesson</Text><Text style={styles.mutedText}>3 / 5 steps</Text></View><ProgressBar progress={60} />
      {[
        ['checkmark-circle', 'Greeting and small talk', 'Completed'],
        ['checkmark-circle', 'Ordering a drink', 'Completed'],
        ['play-circle', 'Talking about preferences', 'Current step'],
        ['ellipse-outline', 'Asking and answering questions', 'Next'],
        ['ellipse-outline', 'A short free conversation', 'Next'],
      ].map(([icon, title, state], index) => <View key={title} style={styles.lessonStep}><Icon name={icon as IconName} size={23} color={index < 2 ? C.green : index === 2 ? C.gold : C.dim} /><View style={{ flex: 1 }}><Text style={styles.lessonStepTitle}>Step {index + 1} · {title}</Text><Text style={styles.lessonStepState}>{state}</Text></View>{index === 2 ? <Icon name="play-circle" size={23} color={C.gold} /> : null}</View>)}
      <AppButton title="Continue lesson" icon="arrow-forward" onPress={() => openChat('Café Conversation')} />
    </ScrollView>
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
      {screen === 'welcome' ? renderWelcome() : <View style={[styles.mainContent, { paddingTop: shortScreen ? 2 : 6 }]}>{renderMainContent()}</View>}
      {isMainTab ? <BottomTabs active={activeTab} onSelect={goTab} bottomInset={insets.bottom} /> : null}
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
  tabBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 8, paddingHorizontal: 7, backgroundColor: 'rgba(33,20,14,0.84)', borderTopWidth: 1, borderTopColor: 'rgba(244,184,110,0.22)', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 },
  tabIconWrap: { width: 39, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  tabIconWrapActive: { backgroundColor: 'rgba(244,184,110,0.15)', borderWidth: 1, borderColor: 'rgba(244,184,110,0.34)' },
  tabLabel: { color: C.dim, fontSize: 9, fontWeight: '600' },
  tabLabelActive: { color: C.gold, fontWeight: '800' },
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
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 52, marginTop: 27 },
  waveBar: { width: 4, backgroundColor: C.gold, borderRadius: 5 },
  voiceStatus: { color: C.white, fontSize: 17, fontWeight: '800', marginTop: 20 },
  voiceHint: { color: C.muted, fontSize: 11, marginTop: 6, textAlign: 'center' },
  voiceControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingBottom: 27 },
  voiceSmallButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A271A', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  voiceMicButton: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.gold, borderWidth: 6, borderColor: '#5A3C25', alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 },
  voiceMicButtonActive: { backgroundColor: C.green, borderColor: '#284A35' },
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
