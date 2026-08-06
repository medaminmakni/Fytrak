# Firebase Setup for Expo Mobile

## Current project mode

This app currently uses Expo managed workflow with Firebase JS SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`).

In this mode:
- You do NOT manually edit Android Gradle files.
- `google-services.json` is configured via `app.json`.

## What is already configured

- `apps/mobile/google-services.json` exists.
- `apps/mobile/app.json` includes:
  - `expo.android.package = com.fytrak`
  - `expo.android.googleServicesFile = ./google-services.json`

## Environment variables required

Create `apps/mobile/.env` from `apps/mobile/.env.example` and fill Firebase values:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

## When Gradle plugin is needed

Use manual Gradle plugin steps only if you move to bare/native Android modules (or custom native Firebase SDKs not handled by Expo config).

Then apply:
- Root `build.gradle(.kts)`: `com.google.gms.google-services` plugin declaration.
- App `build.gradle(.kts)`: apply plugin + Firebase BoM dependencies.

## Run

```powershell
cd apps/mobile
npm run start
```
