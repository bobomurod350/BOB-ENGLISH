# BOB ENGLISH

An Android-first English speaking practice app, built as a standalone Expo / React Native project. Its visual direction follows the selected warm café reference: espresso brown surfaces, cream typography, brass-gold accents, soft rounded cards, and Emma as the first-person AI conversation partner.

## Prototype screens
- Welcome and learning dashboard
- Persistent bottom navigation: Home, Practice, Learn, Progress, Profile
- AI chat and voice conversation preview
- Real-life scenarios: café, airport, job interview, hotel, university, restaurant
- Learning path, grammar, vocabulary, corrections, progress, and profile

## Current interaction scope
Navigation, buttons, scenario launch, text composer, local sample replies, quick replies, vocabulary save/unsave, lesson navigation, and microphone-state preview are implemented. The bottom navigation is present across the app and respects device safe areas.

The conversation replies are local demo responses. The microphone screen is a visual interaction preview. A real AI model, speech-to-text, text-to-speech, account system, and cloud progress storage have not been connected yet. API keys must remain on a secure backend and must never be placed in the mobile app bundle.

## Requirements
- Node.js 22.13 or newer
- npm
- Android phone with a compatible Expo Go version, or Android Studio emulator

## Run on Windows

```powershell
npm install
npx expo start
```

Scan the QR code using Expo Go on Android.

## Checks

```powershell
npm run typecheck
npx expo-doctor
```

## Design tokens
- Background: #170E09
- Surfaces: #21140D, #2B1B12, #382317
- Text: #FFF2E2
- Accent: #F4B86E
- Secondary accent: #D98E42
- Success: #7AD09B


## AI learning platform upgrade

The `feature/ai-learning-platform` branch contains the first adaptive AI learning integration for Emma's Premium Café direction. See [AI_UPGRADE_STATUS.md](./AI_UPGRADE_STATUS.md) for implemented functionality, known limitations and validation instructions. The progress API currently uses process memory and is not durable cloud storage. A deployed HTTPS backend URL is required for mobile API access.
