# Sprint 1 Backlog (Execution Start)

## Objective

Ship shared backend contracts and trainee onboarding through coach assignment + chat thread bootstrap.

## Stories

1. **Auth + role routing**
   - Signup/login
   - Role-based route guard (trainee/coach/admin)
   - Acceptance: user lands on correct role entry screen

2. **Trainee onboarding + assignment state**
   - Basic profile completion
   - Assignment state handling (`unassigned`, `pending`, `assigned`)
   - Acceptance: state updates reflected immediately in UI

3. **Coach discovery + invite request**
   - Discover list with ranking (verified first)
   - Invite via code/email/username
   - Send assignment request with optional intro message
   - Acceptance: request appears in coach pending queue

4. **Coach request decision path**
   - Coach can accept/reject request
   - Accept creates coach-trainee link
   - Rejection updates trainee status and reason
   - Acceptance: one active coach constraint enforced

5. **Chat thread bootstrap**
   - 1:1 trainee-coach thread creation on assignment
   - Text messaging read/unread + timestamp
   - Acceptance: messages sync in real time

6. **Chat image attachments via Cloudinary**
   - Pick image, compress, upload to Cloudinary preset
   - Store metadata in Firestore message
   - Acceptance: receiver can view image in chat

## Engineering tasks

- Define shared TypeScript types for statuses and message schemas.
- Create Firebase security rules draft (role + ownership constraints).
- Implement analytics events: `assignment_requested`, `assignment_approved`, `coach_message_sent`.
- Add i18n scaffolding for `en`, `fr`, `ar` and RTL toggle.

## Definition of done

- Feature tested on iOS/Android simulator.
- No blocker-level lint/build issues.
- Events emitted with correct payload.
- Copy available in three languages for touched screens.
