import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { Platform } from "react-native";

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let messaging: Messaging | null = null;
if (Platform.OS === 'web') {
    try {
        // 브라우저 환경에서만 실행
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            messaging = getMessaging(app);
        }
    } catch (error) {
        console.error("Firebase Messaging failed to initialize", error);
    }
}

export { app, messaging, getToken, onMessage };
export const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || "";
