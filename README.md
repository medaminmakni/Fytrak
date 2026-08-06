# Fytrak

Mobile-first coaching platform (trainee, coach, admin) built with Expo + Firebase.

## Workspace structure

- `apps/mobile` — React Native (Expo) app for trainee + coach
- `apps/admin-web` — Admin dashboard (verification + moderation)
- `packages/shared` — shared types/constants (future)
- `docs` — product + technical documentation
- `configs` — environment templates
- `design` — provided visual references

## Locked V1 decisions

- No AI in V1
- Trainee assistance is direct coach chat
- Coach assignment supports invite or discovery
- Verified coaches are prioritized, but unverified remain visible
- Languages: English, French, Arabic (RTL required)
- Image attachments via Cloudinary (Firebase for auth/data)

## Next implementation order

1. Shared core (auth, role routing, status machine)
2. Trainee flow (end-to-end)
3. Coach flow
4. Admin verification flow
5. QA + release hardening
