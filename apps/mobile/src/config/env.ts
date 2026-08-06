const required = (value: string | undefined, key: string): string => {
  if (!value) {
    console.warn(`Missing required environment variable: ${key}`);
    return "";
  }
  return value;
};

export const appEnv = {
  firebase: {
    apiKey: required(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, "EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: required(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: required(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, "EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: required(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: required(
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    ),
    appId: required(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, "EXPO_PUBLIC_FIREBASE_APP_ID"),
  },
  google: {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    webClientId: required(
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"
    ),
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  },
  facebook: {
    appId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
  },
  cloudinary: {
    cloudName: required(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME, "EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME"),
    uploadPreset: required(
      process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      "EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET"
    ),
  },
  rapidApi: {
    key: process.env.EXPO_PUBLIC_RAPIDAPI_KEY,
    ascendApiHost: process.env.EXPO_PUBLIC_ASCENDAPI_HOST || "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com",
  },
};
