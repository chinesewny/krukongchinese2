// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB3VjP2Lk7mN8x9yZq1wXpL5rT6sU7vW8x9yZ",
    authDomain: "chineseclass-cache.firebaseapp.com",
    projectId: "chineseclass-cache",
    storageBucket: "chineseclass-cache.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdefghijklmnopqrstuv",
    measurementId: "G-ABCDEFGHIJ"
};

// Firebase App Initialization
let firebaseApp;
let firestoreDb;
let firebaseInitialized = false;
let firebaseLoadError = null;

async function initializeFirebase() {
    try {
        // Check if Firebase is already initialized
        if (typeof firebase === 'undefined') {
            console.warn("Firebase SDK not loaded. Loading from CDN...");
            await loadFirebaseSDK();
        }
        
        // Check if Firebase app already exists
        if (firebase.apps && firebase.apps.length > 0) {
            firebaseApp = firebase.apps[0];
        } else {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        }
        
        // Use Firestore
        firestoreDb = firebase.firestore();
        
        // Configure Firestore settings to reduce quota usage
        const settings = {
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
        };
        if (!firestoreDb._initialSettingsApplied) {
    firestoreDb.settings(settings);
    firestoreDb._initialSettingsApplied = true;
}
        
        firebaseInitialized = true;
        
        console.log("Firebase initialized successfully");
        return true;
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        firebaseLoadError = error;
        firebaseInitialized = false;
        return false;
    }
}

function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
        // Load Firebase SDK dynamically
        const firebaseScript = document.createElement('script');
        firebaseScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
        firebaseScript.onload = () => {
            const firestoreScript = document.createElement('script');
            firestoreScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';
            firestoreScript.onload = resolve;
            firestoreScript.onerror = reject;
            document.head.appendChild(firestoreScript);
        };
        firebaseScript.onerror = reject;
        document.head.appendChild(firebaseScript);
    });
}

// Collection names
const FIREBASE_COLLECTIONS = {
    SUBJECTS: 'subjects',
    CLASSES: 'classes',
    STUDENTS: 'students',
    TASKS: 'tasks',
    SCORES: 'scores',
    ATTENDANCE: 'attendance',
    MATERIALS: 'materials',
    SUBMISSIONS: 'submissions',
    RETURNS: 'returns',
    SCHEDULES: 'schedules',
    CACHE_STATUS: 'cache_status'
};
