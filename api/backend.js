const express = require('express');
require('dotenv').config();
const corsMiddleware = require('./cors');

const { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    loginUser, 
    signupUser 
} = require('../utils/firebase');

const { getCloudinaryConfig } = require('../utils/cloudinary');
const { verifyRecaptcha } = require('../utils/recaptcha');
const { askOpenRouter } = require('../utils/openrouter');
const { calculateCustomPrice } = require('../utils/script');

const app = express();

app.use(corsMiddleware);
app.use(express.json());


// ==========================================
// 1. Portfolio API
// ==========================================
app.get('/api/portfolio', async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, 'portfolio'));
        let data = {};
        snapshot.forEach(doc => {
            if (doc.id === 'mainData') {
                data = doc.data();
            }
        });
        res.json({ success: true, data });
    } catch (err) {
        console.error("Portfolio Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ==========================================
// 2. Samples API
// ==========================================
app.get('/api/samples', async (req, res) => {
    try {
        const q = query(collection(db, 'samples'), where('public', '==', true));
        const snap = await getDocs(q);
        const samples = [];
        snap.forEach(doc => samples.push({ id: doc.id, ...doc.data() }));
        res.json({ success: true, data: samples });
    } catch (err) {
        console.error("Samples Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ==========================================
// 3. Auth APIs
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, recaptchaToken } = req.body;

        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
            return res.status(400).json({ success: false, error: "Bot detected" });
        }

        const authData = await loginUser(email, password);
        res.json({ success: true, user: { uid: authData.localId, email: authData.email } });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(401).json({ success: false, error: "Invalid credentials" });
    }
});


app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, profilePic, recaptchaToken } = req.body;

        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
            return res.status(400).json({ success: false, error: "Bot detected" });
        }

        const authData = await signupUser(email, password, name);

        await addDoc(collection(db, 'users'), {
            uid: authData.localId,
            name,
            email,
            profilePic: profilePic || "",
            createdAt: new Date()
        });

        res.json({ success: true, user: { uid: authData.localId, email: authData.email } });

    } catch (err) {
        console.error("Signup Error:", err);
        res.status(400).json({ success: false, error: err.message });
    }
});


// ==========================================
// 4. Config APIs
// ==========================================
app.get('/api/config/recaptcha', (req, res) => {
    res.json({ siteKey: process.env.RECAPTCHA_SITE_KEY });
});

app.get('/api/config/cloudinary', (req, res) => {
    res.json(getCloudinaryConfig());
});


// ==========================================
// 5. Chat APIs (FULL FIXED)
// ==========================================
app.post('/api/chat/send', async (req, res) => {
    try {

        console.log("Incoming Chat:", req.body);

        const { text, userId, email } = req.body;

        if (!text || !userId) {
            return res.status(400).json({
                success: false,
                error: "Text and userId required"
            });
        }

        await addDoc(collection(db, 'messages'), {
            text: text,
            userId: userId,
            email: email || "",
            isAdmin: false,
            timestamp: new Date()
        });

        console.log("Message Saved to Firebase");

        res.json({ success: true });

    } catch (err) {
        console.error("Chat Send Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.get('/api/chat/history', async (req, res) => {
    try {

        const { userId } = req.query;

        if (!userId) {
            return res.json({ success: true, data: [] });
        }

        const snap = await getDocs(
            query(
                collection(db, 'messages'),
                where('userId', '==', userId),
                orderBy('timestamp', 'asc')
            )
        );

        let messages = [];

        snap.forEach(doc => {
            let data = doc.data();

            if (data.timestamp && data.timestamp.toDate) {
                data.timestamp = data.timestamp.toDate().getTime();
            }

            messages.push(data);
        });

        res.json({ success: true, data: messages });

    } catch (err) {
        console.error("Chat History Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ==========================================
// 6. AI Bot
// ==========================================
app.post('/api/chat/bot', async (req, res) => {
    try {
        const { messages } = req.body;
        const reply = await askOpenRouter(messages);
        res.json({ success: true, reply });
    } catch (err) {
        console.error("Bot Error:", err);
        res.status(500).json({ success: false, error: "AI Error" });
    }
});


// ==========================================
// 7. Pricing API
// ==========================================
app.post('/api/pricing/calculate', async (req, res) => {
    try {
        const { baseUsd, currency } = req.body;
        const finalPrice = await calculateCustomPrice(baseUsd, currency);
        res.json({ success: true, ...finalPrice });
    } catch (err) {
        console.error("Pricing Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});


// ==========================================
module.exports = app;
