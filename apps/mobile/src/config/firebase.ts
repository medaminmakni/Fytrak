import { initializeApp, getApps, getApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	getAuth,
	initializeAuth,
	type Auth,
	type Persistence,
} from "firebase/auth";
// Firebase publishes this export from its React Native entrypoint, but its
// generic TypeScript entrypoint does not currently expose the declaration.
// @ts-expect-error React Native-only Firebase Auth export.
import { getReactNativePersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { appEnv } from "./env";

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(appEnv.firebase);

const auth: Auth = (() => {
	try {
		return initializeAuth(firebaseApp, {
			persistence: getReactNativePersistence(AsyncStorage) as Persistence,
		});
	} catch (error) {
		// Fast Refresh can evaluate this module after Auth already exists. Reuse
		// that instance, but never hide a real persistence initialization error.
		if ((error as { code?: string }).code === "auth/already-initialized") {
			return getAuth(firebaseApp);
		}
		throw error;
	}
})();

export { auth };

// The Firebase JavaScript SDK does not support persistent Firestore cache in
// React Native. Keep the supported in-memory cache and rely on explicit local
// drafts for workflows that must survive process termination.
export const db = initializeFirestore(firebaseApp, {
	ignoreUndefinedProperties: true,
});
export const storage = getStorage(firebaseApp);
