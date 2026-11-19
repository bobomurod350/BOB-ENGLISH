# EnglishTalk AI

An Android-first English speaking practice app, built as a standalone Expo / React Native project. The initial visual direction follows the selected warm café reference: espresso brown surfaces, cream typography, brass-gold accents, soft rounded cards, and Emma as the AI conversation partner.

## Current prototype

- Welcome screen
- Home dashboard and learning shortcuts
- Practice scenarios (café, airport, job interview, hotel, university, restaurant)
- First-person AI tutor chat experience (local demo replies for now)
- Voice conversation screen and listening state UI
- Learning path, grammar overview, vocabulary, corrections, and progress screens
- Functional bottom navigation, buttons, quick replies, text composer, save-word controls, and scenario routing

## Important implementation note

This is the first UI prototype. The conversation replies are local demo responses, and the microphone screen is a visual interaction preview. A real AI model, speech-to-text, text-to-speech, account system, and cloud progress storage have not been connected yet. The app is structured so those services can be added through a secure backend; API keys should never be placed in the mobile app bundle.

## Requirements

- Node.js 22.13+ (Node 24 LTS is also suitable)
- npm
- Android phone with Expo Go, or Android Studio emulator

## Run on Windows

```powershell
Set-Location D:\EnglishTalk-AI
npm install
npx expo start
```

Then scan the QR code using Expo Go on Android. To launch an Android emulator, run:

```powershell
npx expo start --android
```

## Check TypeScript

```powershell
npx tsc --noEmit
```

## Design tokens

- Background: `#170E09`
- Surfaces: `#21140D`, `#2B1B12`, `#382317`
- Text: `#FFF2E2`
- Accent: `#F4B86E`
- Secondary accent: `#D98E42`
- Success: `#7AD09B`

## Next engineering milestone

Replace the local demo reply function with a protected backend endpoint, then connect microphone capture, speech recognition, and voice playback. Keep all provider credentials on the server.
