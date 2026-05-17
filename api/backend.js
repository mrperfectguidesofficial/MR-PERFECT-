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

// 6. Bot Chat (OpenRouter) – কাস্টম সিস্টেম প্রম্পট সহ
app.post('/api/chat/bot', async (req, res) => {
    try {
        let { messages } = req.body; // ইউজারের চ্যাট হিস্টোরি (ব্যাকএন্ডে আসবে)

        // বর্তমান সময়, তারিখ, বছর (ইন্ডিয়ান টাইমজোন)
        const now = new Date();
        const indianTime = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        }).format(now);
        const currentYear = now.getFullYear();

        // 💡 কাস্টম সিস্টেম প্রম্পট – আপনার সব নির্দেশনা এখানে
        const systemPrompt = `তুমি "MR Perfect" এর অফিসিয়াল AI সহায়ক।
তোমার নাম "MR Perfect Bot"।
তুমি ওপেনরাউটার (OpenRouter) ব্যবহার করো, মডেলটা মেটা-লামা।

তোমাকে অবশ্যই নিচের নিয়মগুলো কঠোরভাবে মানতে হবে:
❌ কখনো বলবে না: "How can I help", "I am an AI assistant", "How may I assist you"
❌ কখনো সার্ভিসের লিস্ট দেবে না।
❌ কখনো নিজেকে "Artificial Intelligence" বলে পরিচয় দেবে না।
✅ পরিচয় জিজ্ঞেস করলে বলবে: "আমি MR Perfect-এর সহায়ক, আমি সরাসরি ডেভেলপারকে সাহায্য করি।"
✅ উত্তর হবে ছোট, স্বাভাবিক, বন্ধুত্বপূর্ণ।
✅ বাংলা ইনপুট পেলে Bnglish এ উত্তর দেবে (ইংরেজি অক্ষরে বাংলা উচ্চারণ)।
✅ প্রতি উত্তর সর্বোচ্চ ১টি ইমোজি ব্যবহার করবে (ইমোশনাল টোনের জন্য)।
✅ প্রাইসিং সম্পর্কে জানতে চাইলে বলবে: "বেস প্রাইস USD থেকে শুরু, চূড়ান্ত মূল্য ফিচার অনুযায়ী।"

বর্তমান সময় ও তারিখ (Asia/Kolkata): ${indianTime}
বর্তমান বছর: ${currentYear}
মনে রেখো, তুমি একজন রিয়েল হিউম্যানের মতো কথা বলবে, কোনো সাহায্যকারী রোবটের মতো নয়।`;

        // সিস্টেম প্রম্পটকে messages এর শুরুতে যোগ করো
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-15) // সর্বশেষ ১৫টি মেসেজ (টোকেন বাঁচাতে)
        ];

        const reply = await askOpenRouter(fullMessages);
        res.json({ success: true, reply });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "AI Error" });
    }
});

// 7. Dynamic Pricing Logic Execution
app.post('/api/pricing/calculate', async (req, res) => {
    const { baseUsd, currency } = req.body;
    const finalPrice = await calculateCustomPrice(baseUsd, currency);
    res.json({ success: true, ...finalPrice });
});

// Only for Vercel execution
module.exports = app;