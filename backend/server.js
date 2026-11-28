import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

// Load backend/.env regardless of the shell's current working directory.
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const app = express();
const PORT = Number(process.env.PORT || 8787);

const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.1-flash-lite';
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
const apiKey = process.env.GEMINI_API_KEY;

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const liveAi = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1beta' },
    })
  : null;

const CHAT_SCENARIOS = Object.freeze({
  'Free Conversation': 'Have a relaxed, friendly conversation. Ask one question at a time and let the learner choose the topic.',
  'Café Conversation': 'ROLE-PLAY: You are a friendly barista and the learner is a customer. Help them order a drink, choose a size, ask about milk and pay. Stay in the café role until the task is complete.',
  'Airport Travel': 'ROLE-PLAY: You are an airport check-in agent. The learner is a passenger. Help them check in, confirm their destination, ask about luggage and explain where to go next.',
  'Job Interview': 'ROLE-PLAY: You are an interviewer for an entry-level job. Ask one realistic question at a time about the learner, their skills and availability. Give supportive feedback after each answer.',
  'Hotel Check-in': 'ROLE-PLAY: You are a hotel receptionist. The learner is checking in. Ask for their name, booking details and number of nights, then explain the room and breakfast.',
  'University Life': 'ROLE-PLAY: You are a friendly university student meeting the learner on campus. Talk about classes, subjects, hobbies and making friends.',
  'Restaurant Conversation': 'ROLE-PLAY: You are a restaurant server. Help the learner ask about the menu, order food, request changes and ask for the bill.',
  'Introducing Yourself': 'GUIDED TASK: Help the learner introduce themselves with their name, hometown, studies, interests and one goal. Ask for one detail at a time.',
  'Daily Routine': 'GUIDED TASK: Help the learner describe a normal day using simple Present Simple sentences and time expressions.',
  'Present Simple Practice': 'TEACHING TASK: Practise Present Simple. Ask short questions about habits and routines, then gently correct subject-verb agreement.',
  'Grammar Practice': 'TEACHING TASK: Give the learner short A2 grammar prompts. Ask them to build a sentence, then explain one useful correction.',
  'Listening Practice': 'FOLLOW-UP TASK: Ask the learner to retell a short everyday event in simple English and check whether they understood the main details.',
});

const CHAT_MODES = Object.freeze({
  coach: 'COACH MODE: Keep the conversation natural, but gently correct important mistakes. When useful, show a short corrected sentence and explain the reason in simple English. Do not correct every tiny error.',
  conversation: 'FREE TALK MODE: Prioritise a natural, enjoyable conversation. Do not interrupt the flow with grammar lessons. After a few turns, offer one concise improvement the learner could make.',
  challenge: 'CHALLENGE MODE: Make the learner do the thinking. Ask follow-up questions, give hints instead of the full answer, and encourage complete sentences. At the end, give a short score out of 5 with one strength and one improvement.',
});

const EMMA_PROMPT = (level = 'A2', scenario = 'Free Conversation', practiceMode = 'coach') => {
  const sceneInstructions = CHAT_SCENARIOS[scenario] || CHAT_SCENARIOS['Free Conversation'];
  const modeInstructions = CHAT_MODES[practiceMode] || CHAT_MODES.coach;

  return [
    'You are Emma, a friendly female AI English tutor for BOB ENGLISH.',
    '',
    'STUDENT LEVEL: ' + level,
    '',
    'YOUR PERSONALITY:',
    '- Warm, natural, encouraging and respectful.',
    '- Speak like a real English teacher, not like a formal robot.',
    '- Use a gentle, soft, warm feminine voice.',
    '- Use natural conversational English.',
    '- Adapt vocabulary and sentence complexity to the student level.',
    '',
    'CURRENT LEARNING SCENARIO:',
    scenario,
    sceneInstructions,
    '',
    'CURRENT PRACTICE MODE:',
    modeInstructions,
    '',
    'TEACHING RULES:',
    '- Help the student practise real-life English conversations.',
    '- Correct mistakes gently and clearly when the selected mode asks for it.',
    '- Explain grammar in simple words.',
    '- Give one useful example when appropriate.',
    '- Ask one natural follow-up question at a time.',
    '- Do not overload the student with long explanations.',
    '- Encourage the student to speak confidently.',
    '',
    'LANGUAGE:',
    '- Teach and converse in English only.',
    '- Use clear, simple English suitable for the student level.',
    '- If the student is stuck, offer a short hint before giving a full example.',
    '',
    'IMPORTANT:',
    '- Stay in the selected role-play scenario until the practice task is complete.',
    '- Never pretend to be a human.',
    '- Never invent information about the student progress.',
    '- Keep normal replies concise and friendly.',
  ].join('\n');
};

const ALLOWED_PACES = new Set(['slow', 'natural', 'fast']);

// Character IDs are allow-listed on the server. The app can choose a persona,
// but it cannot submit an arbitrary voice name or arbitrary system instruction.
// Emma is the only supported tutor and voice profile.
const CHARACTERS = Object.freeze({
  emma: {
    name: 'Emma',
    voiceName: 'Achernar',
    speechProvider: 'gemini',
    persona:
      'You are Emma, a friendly, patient female AI English tutor. Be warm, calm, encouraging and natural. Speak in a gentle, soft feminine voice. Help the learner practise everyday English, correct mistakes kindly, and ask one simple follow-up question. Keep your sentences clear and suitable for an A2 learner.',
  },
});

const PACE_INSTRUCTIONS = {
  slow: 'Speak slowly and clearly, with natural pauses. Articulate words carefully and give the learner enough time to follow.',
  natural:
    'Speak at a natural, balanced conversational pace. Keep pronunciation clear and friendly.',
  fast: 'Speak at a slightly quicker, energetic conversational pace, but keep every word clear and understandable for an A2 learner.',
};

const LIVE_SPEAKING_CHALLENGES = new Set([
  'Tell Emma about what you did yesterday. Use first, then, after that and finally.',
  'Describe your favourite food without saying its name. Explain its colour, taste and when you eat it.',
  'You have one minute to plan a perfect day in a new city. Tell Emma where you would go and why.',
  'Imagine Emma is visiting your city for the first time. Give her three useful tips and ask her one question.',
]);

function buildLiveSystemInstruction({ character, speakingPace, speakingChallenge }) {
  return [
    'You are ' + character.name + ', an AI English practice partner in BOB ENGLISH.',
    '',
    'STUDENT LEVEL: A2',
    '',
    'CHARACTER PERSONALITY:',
    character.persona,
    '',
    'TODAY SPEAKING MISSION:',
    speakingChallenge,
    'Start by briefly introducing this mission, then listen carefully to the learner. Ask one simple follow-up question that helps them say more.',
    '',
    'TEACHING RULES:',
    '- Practise everyday English conversations.',
    '- Correct mistakes kindly and explain them in simple words.',
    '- Use short, clear sentences suitable for an A2 learner.',
    '- Ask one natural follow-up question to keep the conversation going.',
    '- Be encouraging and patient. Never insult or pressure the learner.',
    '- Give the learner time to finish speaking before responding.',
    '',
    'VOICE DELIVERY:',
    PACE_INSTRUCTIONS[speakingPace],
    '',
    'IDENTITY:',
    'Your character name is ' + character.name + '. Introduce yourself naturally if the learner asks. Stay in character while helping the learner practise English. Always converse in English.',
  ].join('\n');
}

app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  'http://localhost:8081,http://127.0.0.1:8081'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Native React Native requests may not contain an Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed.'));
    },
  }),
);

app.use(express.json({ limit: '64kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
  },
});

app.use('/api', apiLimiter);

function requireGemini(res) {
  if (!ai || !liveAi) {
    res.status(503).json({
      error: 'The AI service is not configured. Check the backend environment settings.',
    });

    return false;
  }

  return true;
}

// Health check. This confirms server startup and key presence, not key validity.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'BOB ENGLISH AI Backend',
    configured: Boolean(apiKey),
    chatModel: CHAT_MODEL,
    liveModel: LIVE_MODEL,
  });
});

// Public character catalogue; contains no secrets or user data.
app.get('/api/characters', (_req, res) => {
  res.json({
    success: true,
    characters: Object.entries(CHARACTERS).map(([id, character]) => ({
      id,
      name: character.name,
      voiceName: character.voiceName,
    })),
  });
});

// Text chat.
app.post('/api/chat', async (req, res) => {
  if (!requireGemini(res)) return;

  const { message, history = [], studentLevel = 'A2', scenario = 'Free Conversation', practiceMode = 'coach' } = req.body ?? {};

  if (
    typeof message !== 'string' ||
    message.trim().length === 0 ||
    message.length > 2000
  ) {
    return res.status(400).json({
      error: 'Message must contain between 1 and 2000 characters.',
    });
  }

  const allowedLevels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const level = allowedLevels.includes(studentLevel) ? studentLevel : 'A2';
  const safeScenario = typeof scenario === 'string' && Object.hasOwn(CHAT_SCENARIOS, scenario) ? scenario : 'Free Conversation';
  const safePracticeMode = typeof practiceMode === 'string' && Object.hasOwn(CHAT_MODES, practiceMode) ? practiceMode : 'coach';

  if (!Array.isArray(history) || history.length > 12) {
    return res.status(400).json({
      error: 'History must be an array containing at most 12 messages.',
    });
  }

  const validHistory = [];

  for (const item of history) {
    if (
      !item ||
      !['user', 'assistant'].includes(item.role) ||
      typeof item.content !== 'string' ||
      item.content.length > 1500
    ) {
      return res.status(400).json({
        error: 'Invalid message in conversation history.',
      });
    }

    validHistory.push({
      role: item.role,
      content: item.content,
    });
  }

  const conversation = [
    ...validHistory,
    { role: 'user', content: message.trim() },
  ];

  const transcript = conversation
    .map(item => {
      const speaker = item.role === 'assistant' ? 'Emma' : 'Student';
      return `${speaker}: ${item.content}`;
    })
    .join('\n\n');

  try {
    const interaction = await ai.interactions.create({
      model: CHAT_MODEL,
      system_instruction: EMMA_PROMPT(level, safeScenario, safePracticeMode),
      input:
        'Continue this English learning conversation. ' +
        "Answer the student's latest message naturally.\n\n" +
        transcript,
      generation_config: {
        max_output_tokens: 350,
      },
      store: false,
    });

    const reply = interaction.output_text?.trim();

    if (!reply) {
      return res.status(502).json({
        error: 'The AI tutor returned an empty response.',
      });
    }

    return res.json({
      success: true,
      reply,
      model: CHAT_MODEL,
    });
  } catch (error) {
    console.error('Gemini chat error:', error?.message || error);

    return res.status(502).json({
      error: 'The AI tutor request failed. Check the backend settings and usage limits.',
    });
  }
});

// Creates a short-lived, single-use token for a direct Gemini Live connection.
// The accepted settings are allow-listed so arbitrary client values cannot be
// injected into the model configuration or system instruction.
app.post('/api/live-token', async (req, res) => {
  if (!requireGemini(res)) return;

  const requestedPace = req.body?.speakingPace;
  const requestedSpeakingChallenge = req.body?.speakingChallenge;
  const speakingChallenge = LIVE_SPEAKING_CHALLENGES.has(requestedSpeakingChallenge)
    ? requestedSpeakingChallenge
    : 'Tell Emma about what you did yesterday. Use first, then, after that and finally.';

  const characterId = 'emma';
  const character = CHARACTERS.emma;
  const voiceName = character.voiceName;

  const speakingPace = ALLOWED_PACES.has(requestedPace)
    ? requestedPace
    : 'natural';

  const systemInstruction = buildLiveSystemInstruction({
    character,
    speakingPace,
    speakingChallenge,
  });

  const now = Date.now();

  const liveConfig = {
    // Emma uses native audio output with Google's Achernar soft female voice.
    // The audio transcript is enabled so the app can display spoken replies.
    responseModalities: ['AUDIO'],

    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName },
      },
    },

    sessionResumption: {},
    inputAudioTranscription: {},
    outputAudioTranscription: {},

    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
  };

  try {
    const token = await liveAi.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(
          now + 60 * 1000,
        ).toISOString(),
        expireTime: new Date(
          now + 30 * 60 * 1000,
        ).toISOString(),

        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: liveConfig,
        },
      },
    });

    if (!token?.name) {
      throw new Error('Gemini did not return an ephemeral token.');
    }

    return res.json({
      success: true,
      token: token.name,
      model: LIVE_MODEL,
      characterId,
      characterName: character.name,
      voiceName,
      speakingPace,
      speakingChallenge,
      systemInstruction,
      expiresInSeconds: 1800,
      newSessionExpiresInSeconds: 60,
    });
  } catch (error) {
    console.error('Gemini Live token error:', error?.message || error);

    return res.status(502).json({
      error: 'Could not create the selected character voice session token.',
    });
  }
});
 

// Adaptive learning content generation for the six learning modules.
const CEFR_LEVELS = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEARNING_SKILLS = ['scenarios', 'vocabulary', 'grammar', 'listening', 'speaking'];
const SKILL_SCHEMAS = {
  scenarios: { title: 'string', context: 'string', role: 'string', goal: 'string', openingLine: 'string', usefulPhrases: ['string'] },
  vocabulary: { title: 'string', words: [{ word: 'string', partOfSpeech: 'string', meaning: 'string', example: 'string', translationHint: 'string' }] },
  grammar: { title: 'string', topic: 'string', explanation: 'string', examples: ['string'], questions: [{ prompt: 'string', options: ['string'], answerIndex: 'number', explanation: 'string' }] },
  listening: { title: 'string', script: 'string', questions: [{ prompt: 'string', options: ['string'], answerIndex: 'number', explanation: 'string' }] },
  speaking: { title: 'string', mission: 'string', prompts: ['string'], successCriteria: ['string'] },
};
function safeProgress(raw) {
  const result = {};
  for (const skill of LEARNING_SKILLS) {
    const value = raw && typeof raw[skill] === 'object' ? raw[skill] : {};
    result[skill] = {
      level: CEFR_LEVELS.includes(value.level) ? value.level : 'A1',
      mastery: Math.max(0, Math.min(100, Number(value.mastery) || 0)),
      attempts: Math.max(0, Math.min(1000000, Number(value.attempts) || 0)),
      accuracy: Math.max(0, Math.min(100, Number(value.accuracy) || 0)),
      weakTopics: Array.isArray(value.weakTopics) ? value.weakTopics.filter(x => typeof x === 'string').slice(0, 12) : [],
    };
  }
  return result;
}
function parseGeneratedJson(value) {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini returned no JSON object.');
  return JSON.parse(text.slice(start, end + 1));
}
function validateActivity(skill, value) {
  const schema = SKILL_SCHEMAS[skill];
  for (const key of Object.keys(schema)) if (!(key in value)) throw new Error('Missing generated field: ' + key);
  if (['grammar', 'listening'].includes(skill)) {
    if (!Array.isArray(value.questions) || value.questions.length < 3 || value.questions.length > 8) throw new Error('Expected 3–8 questions.');
    for (const q of value.questions) {
      if (!Array.isArray(q.options) || q.options.length < 3 || !Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.options.length) throw new Error('Invalid generated question.');
    }
  }
  if (skill === 'vocabulary' && (!Array.isArray(value.words) || value.words.length < 5 || value.words.length > 12)) throw new Error('Expected 5–12 generated words.');
  return value;
}
app.post('/api/learning/generate', async (req, res) => {
  if (!requireGemini(res)) return;
  const { skill, studentLevel, progress: rawProgress, recentTopics = [], learnerGoal } = req.body ?? {};
  if (!Object.hasOwn(SKILL_SCHEMAS, skill)) return res.status(400).json({ error: 'Unsupported learning skill.' });
  const progress = safeProgress(rawProgress);
  const level = CEFR_LEVELS.includes(studentLevel) ? studentLevel : progress[skill].level;
  const topics = Array.isArray(recentTopics) ? recentTopics.filter(x => typeof x === 'string').slice(0, 12) : [];
  const prompt = [
    'You are Emma, the only AI English tutor in BOB ENGLISH. Return valid JSON only, no markdown.',
    'Generate a fresh mobile learning activity for skill ' + skill + ' at CEFR level ' + level + '.',
    'Learner goal: ' + (typeof learnerGoal === 'string' ? learnerGoal.slice(0, 160) : 'everyday communication') + '.',
    'Current skill data: ' + JSON.stringify(progress[skill]) + '.',
    'Weak topics to target: ' + (progress[skill].weakTopics.join(', ') || 'not identified') + '.',
    'Avoid repeating these recent topics: ' + (topics.join(', ') || 'none') + '.',
    'Be accurate for this CEFR level. Use natural practical English. Make the activity different on every request.',
    'Return this JSON shape: ' + JSON.stringify(SKILL_SCHEMAS[skill]),
  ].join('\n');
  try {
    const result = await ai.interactions.create({ model: CHAT_MODEL, input: prompt, generation_config: { max_output_tokens: 1400 }, store: false });
    const activity = validateActivity(skill, parseGeneratedJson(result.output_text));
    return res.json({ success: true, skill, level, activityId: crypto.randomUUID(), activity, generatedAt: new Date().toISOString(), model: CHAT_MODEL });
  } catch (error) {
    console.error('Adaptive learning generation error:', error?.message || error);
    return res.status(502).json({ error: 'Could not generate a valid learning activity. Please try again.' });
  }
});
// Not found.
app.use((_req, res) => {
  res.status(404).json({
    error: 'Route not found.',
  });
});

// Safe error handler.
app.use((error, _req, res, _next) => {
  console.error('Backend error:', error?.message || error);

  res.status(500).json({
    error: 'Internal backend error.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('-----------------------------------');
  console.log('BOB ENGLISH AI BACKEND');
  console.log('-----------------------------------');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Chat:   http://localhost:${PORT}/api/chat`);
  console.log(`Live:   http://localhost:${PORT}/api/live-token`);
  console.log(`AI service configured: ${Boolean(apiKey)}`);
  console.log('-----------------------------------');
});

