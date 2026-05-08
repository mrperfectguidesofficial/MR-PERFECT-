const { db, auth, collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, addDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } = require('./firebase');
const { verifyRecaptcha } = require('./recaptcha');
const { chatWithBot } = require('./openrouter');

// Fetch Main Portfolio Data
const getMainData = async () => {
    const docRef = doc(db, 'portfolio', 'mainData');
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
};

// Fetch Public Samples
const getPublicSamples = async () => {
    const q = query(collection(db, 'samples'), where('public', '==', true));
    const snap = await getDocs(q);
    let samples =[];
    snap.forEach(document => samples.push({ id: document.id, ...document.data() }));
    samples.sort((a, b) => (a.order || 9999) - (b.order || 9999));
    return samples;
};

// Authentication Logic
const loginUser = async (email, password, recaptchaToken) => {
    const isValid = await verifyRecaptcha(recaptchaToken);
    if (!isValid) throw new Error("Invalid reCAPTCHA");

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    return {
        idToken: token,
        localId: userCredential.user.uid,
        email: userCredential.user.email
    };
};

const signupUser = async (email, password, name, profilePic, recaptchaToken) => {
    const isValid = await verifyRecaptcha(recaptchaToken);
    if (!isValid) throw new Error("Invalid reCAPTCHA");

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save to Firestore Database
    await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        profilePic: profilePic || '',
        createdAt: new Date().toISOString()
    });

    const token = await user.getIdToken();
    return {
        idToken: token,
        localId: user.uid,
        email: user.email
    };
};

const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
    return true;
};

// Admin Chat Logic
const getMessages = async (userId) => {
    const q = query(collection(db, 'messages'), where('userId', '==', userId), orderBy('timestamp', 'asc'));
    const snap = await getDocs(q);
    let msgs =[];
    snap.forEach(document => msgs.push(document.data()));
    return msgs;
};

const saveMessage = async (userId, email, text) => {
    await addDoc(collection(db, 'messages'), {
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
    const messages = [{ role: 'system', content: sysPrompt }, ...history.slice(-15)];
    return await chatWithBot(messages);
};

module.exports = {
    getMainData, getPublicSamples, loginUser, signupUser, 
    resetPassword, getMessages, saveMessage, processBotMessage
};