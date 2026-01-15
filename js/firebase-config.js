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
            console.log("Using existing Firebase app");
        } else {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            console.log("Firebase app initialized");
        }
        
        // Use Firestore
        firestoreDb = firebase.firestore();
        
        // Configure Firestore settings to reduce quota usage
        const settings = {
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
            merge: true // Prevent warning about overriding settings
        };
        
        // Apply settings safely
        try {
            if (!firestoreDb._initialSettingsApplied) {
                firestoreDb.settings(settings);
                firestoreDb._initialSettingsApplied = true;
                console.log("Firestore settings applied");
            }
        } catch (settingsError) {
            console.warn("Firestore settings error (non-critical):", settingsError);
        }
        
        firebaseInitialized = true;
        firebaseLoadError = null;
        
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
        // Check if Firebase is already loaded
        if (typeof firebase !== 'undefined') {
            resolve();
            return;
        }
        
        // Load Firebase SDK dynamically
        const firebaseScript = document.createElement('script');
        firebaseScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
        firebaseScript.onload = () => {
            console.log("Firebase App SDK loaded");
            const firestoreScript = document.createElement('script');
            firestoreScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';
            firestoreScript.onload = () => {
                console.log("Firestore SDK loaded");
                resolve();
            };
            firestoreScript.onerror = (error) => {
                console.error("Failed to load Firestore SDK:", error);
                reject(error);
            };
            document.head.appendChild(firestoreScript);
        };
        firebaseScript.onerror = (error) => {
            console.error("Failed to load Firebase App SDK:", error);
            reject(error);
        };
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

// Check Firebase availability
function isFirebaseAvailable() {
    return firebaseInitialized && firestoreDb;
}

// Get current timestamp
function getFirebaseTimestamp() {
    if (isFirebaseAvailable()) {
        return firebase.firestore.FieldValue.serverTimestamp();
    }
    return new Date().toISOString();
}

// Batch operations for performance
async function executeBatchOperations(operations) {
    if (!isFirebaseAvailable()) {
        throw new Error("Firebase not available");
    }
    
    const batch = firestoreDb.batch();
    
    operations.forEach(op => {
        if (op.type === 'set') {
            batch.set(op.ref, op.data, op.options || {});
        } else if (op.type === 'update') {
            batch.update(op.ref, op.data);
        } else if (op.type === 'delete') {
            batch.delete(op.ref);
        }
    });
    
    return await batch.commit();
}

// Get document reference
function getDocRef(collectionName, docId) {
    if (!isFirebaseAvailable()) return null;
    return firestoreDb.collection(collectionName).doc(docId || generateId());
}

// Generate ID
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Firebase Storage Functions (if needed)
async function uploadFileToStorage(file, path) {
    if (!isFirebaseAvailable()) {
        throw new Error("Firebase not available for file upload");
    }
    
    const storage = firebase.storage();
    const storageRef = storage.ref();
    const fileRef = storageRef.child(path + '/' + file.name);
    
    const snapshot = await fileRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();
    
    return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        name: file.name,
        size: file.size,
        type: file.type
    };
}

// Clear all cached data
async function clearAllCache() {
    if (!isFirebaseAvailable()) return;
    
    try {
        const collections = Object.values(FIREBASE_COLLECTIONS);
        
        for (const collectionName of collections) {
            const querySnapshot = await firestoreDb.collection(collectionName).get();
            const batch = firestoreDb.batch();
            
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            if (querySnapshot.size > 0) {
                await batch.commit();
                console.log(`Cleared ${collectionName}: ${querySnapshot.size} documents`);
            }
        }
        
        // Clear cache status
        await firestoreDb.collection(FIREBASE_COLLECTIONS.CACHE_STATUS).doc('last_sync').delete();
        
        console.log("All cache cleared successfully");
        return true;
    } catch (error) {
        console.error("Error clearing cache:", error);
        throw error;
    }
}

// Check cache status
async function getCacheStatus() {
    if (!isFirebaseAvailable()) return null;
    
    try {
        const doc = await firestoreDb.collection(FIREBASE_COLLECTIONS.CACHE_STATUS)
            .doc('last_sync')
            .get();
        
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        console.error("Error getting cache status:", error);
        return null;
    }
}

// Update cache status
async function updateCacheStatus() {
    if (!isFirebaseAvailable()) return;
    
    try {
        await firestoreDb.collection(FIREBASE_COLLECTIONS.CACHE_STATUS)
            .doc('last_sync')
            .set({
                timestamp: getFirebaseTimestamp(),
                updatedAt: new Date().toISOString()
            });
    } catch (error) {
        console.error("Error updating cache status:", error);
    }
}

// Test Firebase connection
async function testFirebaseConnection() {
    if (!isFirebaseAvailable()) return false;
    
    try {
        // Try a simple read operation
        const testRef = firestoreDb.collection('test_connection').doc('ping');
        await testRef.set({
            timestamp: getFirebaseTimestamp(),
            test: 'connection_test'
        });
        
        // Clean up
        await testRef.delete();
        
        console.log("Firebase connection test successful");
        return true;
    } catch (error) {
        console.error("Firebase connection test failed:", error);
        return false;
    }
}

// Initialize on load if in browser
if (typeof window !== 'undefined') {
    // Optional: Auto-initialize after a delay
    setTimeout(() => {
        // Don't auto-init if there's an explicit initialization elsewhere
        if (!firebaseInitialized && typeof initializeFirebase === 'function') {
            console.log("Auto-initializing Firebase...");
            initializeFirebase().catch(err => {
                console.warn("Auto-initialization failed:", err);
            });
        }
    }, 2000);
}

// Export for Node.js/ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        initializeFirebase,
        isFirebaseAvailable,
        getFirebaseTimestamp,
        executeBatchOperations,
        getDocRef,
        generateId,
        uploadFileToStorage,
        clearAllCache,
        getCacheStatus,
        updateCacheStatus,
        testFirebaseConnection,
        FIREBASE_COLLECTIONS,
        firebaseInitialized,
        firestoreDb,
        firebaseApp
    };
}
