const { db } = require('./firebase');
const { verifyRecaptcha } = require('./recaptcha');
const { chatWithBot } = require('./openrouter');
const axios = require('axios');

// Fetch Main Portfolio Data
const getMainData = async () => {
    const doc = await db.collection('portfolio').doc('mainData').get();
    return doc.exists ? doc.data() : {};
};

// Fetch Public Samples
const getPublicSamples = async () => {
    const snap = await db.collection('samples').where('public', '==', true).get();
    let samples =[];
    snap.forEach(doc => samples.push({ id: doc.id, ...doc.data() }));
    samples.sort((a, b) => (a.order || 9999) - (b.order || 9999));
    return samples;
};

// Authentication Logic (Using Firebase REST API for Client Login without Web SDK)
const loginUser = async (email, password, recaptchaToken) => {
    const isValid = await verifyRecaptcha(recaptchaToken);
    if (!isValid) throw new Error("Invalid reCAPTCHA");

    const apiKey = process.env.FIREBASE_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    
    const res = await axios.post(url, { email, password, returnSecureToken: true });
    return res.data; // Contains idToken, localId (uid), email
};

const signupUser = async (email, password, name, profilePic, recaptchaToken) => {
    const isValid = await verifyRecaptcha(recaptchaToken);
    if (!isValid) throw new Error("Invalid reCAPTCHA");

    const apiKey = process.env.FIREBASE_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    
    // Create Auth User
    const res = await axios.post(url, { email, password, returnSecureToken: true });
    const user = res.data;

    // Save to Firestore Database
    await db.collection('users').doc(user.localId).set({
        name,
        email,
        profilePic: profilePic || '',
        createdAt: new Date().toISOString()
    });

    return user;
};

const resetPassword = async (email) => {
    const apiKey = process.env.FIREBASE_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
    await axios.post(url, { requestType: "PASSWORD_RESET", email });
    return true;
};

// Admin Chat Logic
const getMessages = async (userId) => {
    const snap = await db.collection('messages')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .get();
    let msgs =[];
    snap.forEach(doc => msgs.push(doc.data()));
    return msgs;
};

const saveMessage = async (userId, email, text) => {
    await db.collection('messages').add({
        text,
        userId,
        email,
        timestamp: new Date().toISOString(),
        isAdmin: false
    });
    return true;
};

// Bot Chat Logic
const processBotMessage = async (history) => {
    const sysPrompt = "You are a friendly AI Assistant. Keep answers concise, helpful, and natural.";
    const messages =[{ role: 'system', content: sysPrompt }, ...history.slice(-15)];
    return await chatWithBot(messages);
};

module.exports = {
    getMainData, getPublicSamples, loginUser, signupUser, 
    resetPassword, getMessages, saveMessage, processBotMessage
};