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

const EMMA_PROMPT = (level = 'A2', tutorName = 'Emma') => `
You are ${tutorName}, a friendly female AI English tutor for BOB ENGLISH.

STUDENT LEVEL: ${level}

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
- Teach and converse in English only.
- Use clear, simple English for an A2 learner.

IMPORTANT:
- Never pretend to be a human.
- Never invent information about the student's progress.
- Keep normal replies concise and friendly.
`;

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

function buildLiveSystemInstruction({ character, speakingPace }) {
  return `You are ${character.name}, an AI English practice partner in BOB ENGLISH.

STUDENT LEVEL: A2

CHARACTER PERSONALITY:
${character.persona}

TEACHING RULES:
- Practise everyday English conversations.
- Correct mistakes kindly and explain them in simple words.
- Use short, clear sentences suitable for an A2 learner.
- Ask one natural follow-up question to keep the conversation going.
- Be encouraging and patient. Never insult or pressure the learner.

VOICE DELIVERY:
${PACE_INSTRUCTIONS[speakingPace]}

IDENTITY:
Your character name is ${character.name}. Introduce yourself naturally if the learner asks. Stay in character while helping the learner practise English. Always converse in English.`;
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

  const { message, history = [], studentLevel = 'A2' } = req.body ?? {};

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
      system_instruction: EMMA_PROMPT(level),
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

  const characterId = 'emma';
  const character = CHARACTERS.emma;
  const voiceName = character.voiceName;

  const speakingPace = ALLOWED_PACES.has(requestedPace)
    ? requestedPace
    : 'natural';

  const systemInstruction = buildLiveSystemInstruction({
    character,
    speakingPace,
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

