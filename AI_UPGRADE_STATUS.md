# BOB ENGLISH — Adaptive AI Upgrade Status

Selected direction: Emma's Premium Café (A).
Branch: `feature/ai-learning-platform`.
Base branch: `validation/all-prs`.

## Current implementation snapshot

### Added in this branch
- Gemini-backed `POST /api/learning/generate` route for Scenarios, Vocabulary, Grammar, Listening and Speaking.
- CEFR level support from Pre-A1 through C2 in the generation prompt and response.
- Learner skill state structure with mastery, attempts, accuracy and weak-topic history.
- Attempt-recording endpoint `POST /api/learning/attempt`.
- Progress read endpoint `GET /api/learning/progress/:learnerId`.
- Saved vocabulary endpoint `POST /api/learning/saved-words`.
- Dedicated Grammar Detective screen and shared AI activity panel.
- Vocabulary and Listening screens now request generated activities rather than relying only on the built-in fixed arrays.
- Scenarios screen uses an AI activity panel.
- Chat request uses the current chat skill level instead of hard-coding A2.
- Mobile API URL no longer hard-codes a LAN IP; it reads `EXPO_PUBLIC_API_URL`.

## Important limitations / not yet production-ready
- The progress endpoints currently use process memory (Map). Data resets when the backend restarts. This is NOT durable cloud persistence.
- There is no authentication system or database schema configured in this repo. Durable cross-device progress requires a database and authenticated user identity.
- The learner ID is currently generated in app state; durable identity persistence must be completed after adding and locking an AsyncStorage dependency.
- Quiz answer selection/score submission for newly generated Grammar and Listening activities is not yet fully implemented.
- Speaking screen still uses existing Gemini Live microphone flow and fixed prompts; generated speaking activity is not yet bound to the selected live mission.
- Vocabulary saved-word UI currently uses in-memory app state; API sync is not yet wired.
- Audio for generated Listening scripts is currently played through Expo Speech device TTS, not generated natural voice audio. This is not equivalent to AI audio generation.
- No live backend URL is configured. Set `EXPO_PUBLIC_API_URL` to a deployed HTTPS backend URL to use the API from a phone.
- No TypeScript, Android build or runtime tests have been run from this remote GitHub connector environment. Do not treat the feature as verified until local checks pass.

## Required validation after pulling
1. Regenerate package lock with `npm install` if package dependencies changed.
2. Run `npm run typecheck`.
3. Run `node --check .\backend\server.js` from project root.
4. Deploy backend and set `EXPO_PUBLIC_API_URL` to its HTTPS URL.
5. Test each generate endpoint with all five skills.
6. Test Android microphone permission and Gemini Live session on a real device.
7. Add and test durable database-backed progress before production release.

## Security note
Never commit `backend/.env`, Gemini API keys, or tokens. Do not enable public learner progress endpoints for sensitive data without authentication and authorization.
