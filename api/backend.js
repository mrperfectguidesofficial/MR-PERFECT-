const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { collection, addDoc, getDocs, query, where, orderBy } = require('firebase/firestore');
const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { db, auth } = require('../utils/firebase');
require('dotenv').config();

const app = express();

// CORS Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// ==========================================
// 1. Configuration APIs (reCAPTCHA & Cloudinary)
// ==========================================
app.get('/api/config/recaptcha', (req, res) => {
    res.json({ siteKey: process.env.RECAPTCHA_SITE_KEY });
});

app.get('/api/config/cloudinary', (req, res) => {
    res.json({
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    });
});

// ==========================================
// 2. Chat System API (Developer & AI)
// ==========================================
app.post('/api/chat/send', async (req, res) => {
    try {
        const { text, userId, email } = req.body;
        
        // Firebase ডাটাবেসে মেসেজ সেভ করা হচ্ছে
        await addDoc(collection(db, 'messages'), {
            text: text,
            userId: userId,
            email: email || '',
            timestamp: new Date(),
            isAdmin: false // যেহেতু ইউজার থেকে আসছে
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error("Chat Send Error:", error);
        res.json({ success: false, error: 'Failed to send message' });
    }
});

app.get('/api/chat/history', async (req, res) => {
    try {
        const { userId } = req.query;
        const q = query(
            collection(db, 'messages'),
            where('userId', '==', userId),
            orderBy('timestamp', 'asc')
        );
        const snapshot = await getDocs(q);
        
        let messages =[];
        snapshot.forEach(doc => {
            let data = doc.data();
            // ফ্রন্টএন্ডের সুবিধার জন্য টাইমস্ট্যাম্প মিলি-সেকেন্ডে রূপান্তর
            if (data.timestamp && data.timestamp.toDate) {
                data.timestamp = data.timestamp.toDate().getTime();
            }
            messages.push(data);
        });
        
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error("Chat History Error:", error);
        res.json({ success: false, error: 'Failed to fetch history' });
    }
});

app.post('/api/chat/bot', async (req, res) => {
    try {
        const { messages } = req.body;
        const reply = await askOpenRouter(messages);
        res.json({ success: true, reply });
    } catch (err) { res.status(500).json({ success: false, error: "AI Error" }); }
});

// ==========================================
// 3. Portfolio & Samples API
// ==========================================
app.get('/api/portfolio', async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, 'portfolio'));
        let data = {};
        snapshot.forEach(doc => { data = doc.data(); });
        res.json({ success: true, data });
    } catch (error) {
        res.json({ success: false, error: 'Failed to fetch portfolio' });
    }
});

app.get('/api/samples', async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, 'samples'));
        let data =[];
        snapshot.forEach(doc => { 
            data.push({ id: doc.id, ...doc.data() }); 
        });
        res.json({ success: true, data });
    } catch (error) {
        res.json({ success: false, error: 'Failed to fetch samples' });
    }
});

// ==========================================
// 4. Auth & Pricing APIs
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        res.json({ success: true, user: { uid: userCredential.user.uid, email: userCredential.user.email } });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        res.json({ success: true, user: { uid: userCredential.user.uid, email: userCredential.user.email } });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/pricing/calculate', async (req, res) => {
    const { baseUsd, currency } = req.body;
    const finalPrice = await calculateCustomPrice(baseUsd, currency);
    res.json({ success: true, ...finalPrice });
});

// Only for Vercel execution
module.exports = app;
