const express = require('express');
require('dotenv').config();
const corsMiddleware = require('./cors');

const { db, collection, getDocs, addDoc, query, where, orderBy, loginUser, signupUser } = require('../utils/firebase');
const { getCloudinaryConfig } = require('../utils/cloudinary');
const { verifyRecaptcha } = require('../utils/recaptcha');
const { askOpenRouter } = require('../utils/openrouter');
const { calculateCustomPrice } = require('../utils/script');

const app = express();
app.use(corsMiddleware);
app.use(express.json());

// ✅ নতুন: reCAPTCHA সাইট-কী প্রদানের এন্ডপয়েন্ট
app.get('/api/config/recaptcha', (req, res) => {
    res.json({ siteKey: process.env.RECAPTCHA_SITE_KEY });
});

// 1. Get Portfolio Data
app.get('/api/portfolio', async (req, res) => {
    try {
        const docSnap = await getDocs(collection(db, 'portfolio'));
        let data = {};
        docSnap.forEach(doc => { if(doc.id === 'mainData') data = doc.data(); });
        res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 2. Get Samples
app.get('/api/samples', async (req, res) => {
    try {
        const q = query(collection(db, 'samples'), where('public', '==', true));
        const snap = await getDocs(q);
        const samples =[];
        snap.forEach(doc => samples.push({ id: doc.id, ...doc.data() }));
        res.json({ success: true, data: samples });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 3. Auth (Login/Signup) – reCAPTCHA ভেরিফিকেশন আগের মতোই আছে
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, recaptchaToken } = req.body;
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) return res.status(400).json({ success: false, error: "Bot detected" });

        const authData = await loginUser(email, password);
        res.json({ success: true, user: { uid: authData.localId, email: authData.email } });
    } catch (err) { res.status(401).json({ success: false, error: "Invalid credentials" }); }
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, profilePic, recaptchaToken } = req.body;
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) return res.status(400).json({ success: false, error: "Bot detected" });

        const authData = await signupUser(email, password, name);
        // Save user to Firestore
        await addDoc(collection(db, 'users'), { uid: authData.localId, name, email, profilePic, createdAt: new Date() });
        res.json({ success: true, user: { uid: authData.localId, email: authData.email } });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

// 4. Config APIs
app.get('/api/config/cloudinary', (req, res) => {
    res.json(getCloudinaryConfig());
});

// 5. Chat APIs
app.post('/api/chat/send', async (req, res) => {
    try {
        const { text, userId, email } = req.body;
        await addDoc(collection(db, 'messages'), { text, userId, email, isAdmin: false, timestamp: new Date() });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// ✅ আপডেটেড: orderBy ও টাইমস্ট্যাম্প কনভার্শন (অ্যাডমিন প্যানেলে মেসেজ দেখানোর জন্য)
app.get('/api/chat/history', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.json({ success: true, data:[] });

        const q = query(
            collection(db, 'messages'),
            where('userId', '==', userId),
            orderBy('timestamp', 'asc')      // ✅ অর্ডারিং যোগ করা হয়েছে
        );
        const snap = await getDocs(q);
        let msgs =[];
        snap.forEach(d => {
            let data = d.data();
            // Firestore টাইমস্ট্যাম্পকে মিলিসেকেন্ডে রূপান্তর (ফ্রন্টএন্ড সুবিধা)
            if (data.timestamp && data.timestamp.toDate) {
                data.timestamp = data.timestamp.toDate().getTime();
            }
            msgs.push(data);
        });
        res.json({ success: true, data: msgs });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 6. Bot Chat (OpenRouter)
app.post('/api/chat/bot', async (req, res) => {
    try {
        const { messages } = req.body;
        const reply = await askOpenRouter(messages);
        res.json({ success: true, reply });
    } catch (err) { res.status(500).json({ success: false, error: "AI Error" }); }
});

// 7. Dynamic Pricing Logic Execution
app.post('/api/pricing/calculate', async (req, res) => {
    const { baseUsd, currency } = req.body;
    const finalPrice = await calculateCustomPrice(baseUsd, currency);
    res.json({ success: true, ...finalPrice });
});

// Only for Vercel execution
module.exports = app;
