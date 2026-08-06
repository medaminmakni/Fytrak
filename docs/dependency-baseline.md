# Dependency Baseline (Locked)

## Runtime baseline

- Node.js: `24.14.0` (Active LTS)
- npm: `11.9.0`

## Mobile (`apps/mobile`)

- expo: `~55.0.5`
- react: `19.2.0`
- react-native: `0.83.2` (Expo SDK-compatible)
- firebase: `12.10.0`
- i18next: `25.8.14`
- react-i18next: `16.5.6`
- expo-image-picker: `~55.0.11`
- expo-image-manipulator: `~55.0.9`
- expo-localization: `~55.0.8`

## Admin (`apps/admin-web`)

- vite: `7.3.1`
- react: `19.2.0`
- react-dom: `19.2.0`
- @vitejs/plugin-react: `5.1.4`
- firebase: `12.10.0`
- i18next: `25.8.14`
- react-i18next: `16.5.6`

## Notes

- Versions are pinned exactly in `package.json` (except Expo SDK managed `~` packages).
- Root `.npmrc` sets `save-exact=true` for future installs.
