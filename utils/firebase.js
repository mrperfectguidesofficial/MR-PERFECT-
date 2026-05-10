const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, orderBy } = require('firebase/firestore');
const axios = require('axios');

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ==========================
// 🔥 NEW: Firestore REST Write
// ==========================
async function addMessageToFirestore(data) {

    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/messages?key=${firebaseConfig.apiKey}`;

    const body = {
        fields: {
            text: { stringValue: data.text },
            userId: { stringValue: data.userId },
            email: { stringValue: data.email || "" },
            isAdmin: { booleanValue: data.isAdmin || false },
            timestamp: { timestampValue: new Date().toISOString() }
        }
    };

    await axios.post(url, body);
}


// ==========================
// Auth via REST
// ==========================
async function loginUser(email, password) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
    const res = await axios.post(url, { email, password, returnSecureToken: true });
    return res.data;
}

async function signupUser(email, password) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
    const res = await axios.post(url, { email, password, returnSecureToken: true });
    return res.data;
}

module.exports = { 
    db, 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    loginUser, 
    signupUser,
    addMessageToFirestore
};
