const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, addDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } = require('firebase/auth');

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENTID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

module.exports = { 
    app, db, auth, 
    collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, addDoc, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail 
};