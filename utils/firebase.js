const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, query, where, orderBy } = require('firebase/firestore');
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

// Auth using Firebase REST API (Because Admin SDK is not allowed)
async function loginUser(email, password) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
    const res = await axios.post(url, { email, password, returnSecureToken: true });
    return res.data; // contains localId (uid), idToken, email
}

async function signupUser(email, password, name) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
    const res = await axios.post(url, { email, password, returnSecureToken: true });
    return res.data;
}

module.exports = { db, collection, getDocs, addDoc, query, where, orderBy, loginUser, signupUser };
