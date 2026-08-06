# Cloudinary Integration (V1)

## Goal

Support trainee/coach chat image attachments in V1 with low-cost external storage, while keeping Firebase for auth and app data.

## High-level flow

1. User picks image in mobile app.
2. App compresses image (target <= 1MB).
3. App uploads file to Cloudinary using unsigned upload preset.
4. Cloudinary returns `secure_url`, `public_id`, dimensions, format, bytes.
5. App writes chat message document in Firestore with Cloudinary metadata.
6. Receiver sees image message in thread.

## Firestore message shape (image)

```json
{
  "id": "msg_xxx",
  "threadId": "thread_xxx",
  "senderId": "user_xxx",
  "receiverId": "user_yyy",
  "type": "image",
  "text": "",
  "image": {
    "url": "https://res.cloudinary.com/...",
    "publicId": "fytrak/chat/abc123",
    "width": 1080,
    "height": 1080,
    "format": "jpg",
    "bytes": 342100
  },
  "status": "sent",
  "readAt": null,
  "createdAt": "serverTimestamp"
}
```

## Cloudinary setup

- Create cloud account and cloud name.
- Create **unsigned upload preset** for mobile uploads.
- Restrict preset:
  - Folder: `fytrak/chat`
  - Allowed formats: jpg, jpeg, png, webp
  - Max file size: 2MB
  - Moderate transformation defaults if needed

## Security notes

- Never expose Cloudinary API secret in mobile app.
- Use unsigned preset only with strict limits.
- For stricter security later, move to signed uploads via backend function.

## Deletion strategy (V1)

- V1: soft-delete message from app only.
- V1.1: admin cleanup job for orphaned images by `public_id`.

## Migration option

If moving to Firebase Storage later:

- Keep message schema stable (`image.url`, `publicId` optional)
- Add `storageProvider` field (`cloudinary` | `firebase`)
- Migrate old URLs lazily on message access if needed
