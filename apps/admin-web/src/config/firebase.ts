import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { adminEnv } from "./env";

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(adminEnv.firebase);

export const adminAuth = getAuth(firebaseApp);
export const adminDb = getFirestore(firebaseApp);
