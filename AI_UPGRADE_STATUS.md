# BOB ENGLISH — Adaptive AI Upgrade Status

Selected design: **A — Emma's Premium Café**.
Working branch: `feature/ai-learning-platform`.
Base branch: `validation/all-prs`.

## Implemented in this branch

### Mobile app
- Existing Expo/React Native app and Emma visual identity retained; no replacement template introduced.
- AI activity panel supports generated explanations, role-play context, examples, vocabulary cards, listening scripts, speaking prompts and multiple-choice questions.
- Scenarios, Vocabulary, Grammar Detective, Listening Lab and Speaking screens request fresh AI-generated content.
- Grammar and Listening generated MCQs support answer selection, explanations, score calculation and attempt submission.
- Vocabulary generated words can be heard with device text-to-speech and saved through the API.
- Chat sends current skill level, learner profile and generated scenario context to Emma.
- Speaking screen requests a generated mission and passes it into the existing Gemini Live token request.
- Mobile API URL is configurable through `EXPO_PUBLIC_API_URL`; a placeholder is present and must be replaced by the deployed HTTPS backend URL.
- The old hard-coded LAN address has been removed.
- The six existing app modules and navigation are retained.

### Backend
- Gemini-backed `POST /api/learning/generate` creates structured fresh content for Scenarios, Vocabulary, Grammar, Listening and Speaking.
- CEFR labels supported in prompts: Pre-A1, A1, A2, B1, B2, C1, C2.
- Generation prompt can use per-skill levels, mastery, accuracy, attempt counts and weak topics.
- Added `GET /api/learning/progress/:learnerId`, `POST /api/learning/attempt`, and `POST /api/learning/saved-words`.
- Emma Chat and Gemini Live prompt builders can receive learner progress.
- Generated scenario context is passed into Emma chat; generated speaking missions can be used in Live instructions.
- UUID creation uses the explicit Node `crypto` import.

## Not production-ready / not verified

- **Progress is not durable cloud storage.** The current backend uses a process-local `Map`; progress is erased on backend restart or redeploy. Do not rely on it as saved account data.
- There is no authenticated account system or database connection in this branch.
- A Supabase project named `medmind-ai` was visible on the connected account but is inactive; it was not modified. Migrations could not be inspected due to a connection timeout.
- The learner identifier is stored in memory in this build; closing/restarting the app can create a new identifier. Durable identity and cloud sync remain to be implemented with a live account/database.
- Listening audio is device text-to-speech through Expo Speech. It is not Gemini-generated natural audio.
- Speaking uses the existing Gemini Live microphone/audio session code. Device microphone permissions, Live session startup, streaming, speech recognition and transcript scoring have not been tested on a real Android device.
- Speaking mission generation is connected to the Live prompt, but no post-session speech evaluation / pronunciation score persistence is implemented yet.
- Chat skill progress is supplied to the tutor prompt, but Chat conversation turns are not yet scored and saved as formal skill attempts.
- Some UI screens were changed remotely through GitHub Contents API. TypeScript, Expo Doctor, Android prebuild, APK build and runtime tests have **not** been run in this environment.
- No live HTTPS backend deployment or Android APK build has been performed.

## Validation required after pulling

Run from the project root:

```powershell
npm install
npm run typecheck
node --check .\backend\server.js
```

Then:
1. Configure `backend/.env` with a private Gemini API key (never commit this file).
2. Deploy the backend to an HTTPS service.
3. Set the root Expo build environment variable `EXPO_PUBLIC_API_URL` to that HTTPS URL.
4. Test every `/api/learning/generate` skill route against the configured Gemini model.
5. Test Chat, microphone permission, Gemini Live audio playback/transcription and generated Speaking mission on the physical Android phone.
6. Add authenticated, durable DB storage before using progress as real user data.
7. Run an Android EAS APK build only after local typecheck and Android/device tests pass.

## Security
- Never commit API keys or backend `.env`.
- Progress endpoints currently accept anonymous learner IDs and are for early integration only. Add authentication and per-user authorization before production.
- Do not treat the current in-memory progress store as secure account storage.
