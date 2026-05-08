const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { initializeApp } = require('firebase/app');
const {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    where,
    orderBy,
    addDoc
} = require('firebase/firestore');
const {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} = require('firebase/auth');

// -------------------------------------------------------------------
// Environment‑driven configuration (do NOT hardcode secrets)
// -------------------------------------------------------------------
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENTID
};

// Firebase initialisation
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// -------------------------------------------------------------------
// Helper modules (inlined)
// -------------------------------------------------------------------

// recaptcha helpers
const verifyRecaptcha = async (token) => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) return true; // bypass if not configured
    try {
        const res = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`
        );
        return res.data.success;
    } catch (error) {
        console.error('reCAPTCHA Error:', error);
        return false;
    }
};

const getSiteKey = () => process.env.RECAPTCHA_SITE_KEY;

// Cloudinary config
const getCloudinaryConfig = () => ({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
});

// OpenRouter AI chat
const chatWithBot = async (messages) => {
    try {
        const res = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: process.env.OPENROUTER_MODEL || 'openrouter/free',
                messages: messages,
                temperature: 0.75,
                max_tokens: 600
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return res.data.choices[0].message.content;
    } catch (error) {
        console.error('OpenRouter Error:', error);
        throw new Error('Failed to connect to AI');
    }
};

// -------------------------------------------------------------------
// Public API proxies
// -------------------------------------------------------------------
const publicApi = {
    getCountries: async () => {
        const res = await axios.get('https://restcountries.com/v3.1/all?fields=name,cca2,currencies');
        return res.data;
    },
    getIP: async () => {
        const res = await axios.get('https://ipapi.co/json/');
        return res.data;
    },
    getExchangeRates: async () => {
        const res = await axios.get('https://open.er-api.com/v6/latest/USD');
        return res.data;
    }
};

// -------------------------------------------------------------------
// Scripts (your original business logic, unchanged)
// -------------------------------------------------------------------
const getMainData = async () => {
    const docRef = doc(db, 'portfolio', 'mainData');
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
};

const getPublicSamples = async () => {
    const q = query(collection(db, 'samples'), where('public', '==', true));
    const snap = await getDocs(q);
    let samples = [];
    snap.forEach(document => samples.push({ id: document.id, ...document.data() }));
    samples.sort((a, b) => (a.order || 9999) - (b.order || 9999));
    return samples;
};

const loginUser = async (email, password, recaptchaToken) => {
    const isValid = await verifyRecaptcha(recaptchaToken);
    if (!isValid) throw new Error('Invalid reCAPTCHA');
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
    if (!isValid) throw new Error('Invalid reCAPTCHA');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
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

const getMessages = async (userId) => {
    const q = query(
        collection(db, 'messages'),
        where('userId', '==', userId),
        orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    let msgs = [];
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

const processBotMessage = async (history) => {
    const sysPrompt = 'You are a friendly AI Assistant. Keep answers concise, helpful, and natural.';
    const messages = [{ role: 'system', content: sysPrompt }, ...history.slice(-15)];
    return await chatWithBot(messages);
};

// -------------------------------------------------------------------
// Express app & routes (identical to backend.js)
// -------------------------------------------------------------------
const app = express();

// CORS
app.use(
    cors({
        origin: process.env.ALLOWED_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
);

app.use(express.json());

// Auth Middleware
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
            { idToken: token }
        );
        const userData = response.data.users[0];
        req.user = { uid: userData.localId, email: userData.email };
        next();
    } catch (e) {
        res.status(401).json({ error: 'Unauthorized token' });
    }
};

// 1. Config route
app.get('/api/config', (req, res) => {
    res.json({
        recaptchaSiteKey: getSiteKey(),
        ...getCloudinaryConfig()
    });
});

// 2. Portfolio & Samples
app.get('/api/portfolio', async (req, res) => {
    try {
        res.json(await getMainData());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/samples', async (req, res) => {
    try {
        res.json(await getPublicSamples());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, recaptcha } = req.body;
        const data = await loginUser(email, password, recaptcha);
        res.json({ token: data.idToken, uid: data.localId, email: data.email });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name, profilePic, recaptcha } = req.body;
        const data = await signupUser(email, password, name, profilePic, recaptcha);
        res.json({ token: data.idToken, uid: data.localId, email: data.email });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/auth/reset', async (req, res) => {
    try {
        await resetPassword(req.body.email);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. Admin Chat
app.get('/api/chat/messages', authenticate, async (req, res) => {
    try {
        res.json(await getMessages(req.user.uid));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat/message', authenticate, async (req, res) => {
    try {
        await saveMessage(req.user.uid, req.user.email, req.body.text);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Bot Chat
app.post('/api/chat/bot', async (req, res) => {
    try {
        const reply = await processBotMessage(req.body.history);
        res.json({ reply });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Proxied Public APIs
app.get('/api/public/countries', async (req, res) => {
    try {
        res.json(await publicApi.getCountries());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/ip', async (req, res) => {
    try {
        res.json(await publicApi.getIP());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/rates', async (req, res) => {
    try {
        res.json(await publicApi.getExchangeRates());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------------
// Export for Vercel serverless function
// -------------------------------------------------------------------
module.exports = app;