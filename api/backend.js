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

// 6. Bot Chat (OpenRouter) – প্রফেশনাল ইংলিশ প্রম্পট সহ
app.post('/api/chat/bot', async (req, res) => {
    try {
        let { messages } = req.body;

        // বর্তমান সময় ও তারিখ (ইন্ডিয়ান টাইমজোন)
        const now = new Date();
        const currentTime = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        }).format(now);

        // ✅ আপনার দেওয়া সম্পূর্ণ সিস্টেম প্রম্পট (ইংরেজি)
        const systemPrompt = `You are Mr Ai — the Official Intelligent Business Assistant of Mr Perfect.

You represent a high-level Full-Stack Developer & System Architect.

Your role is to:
• Explain services professionally
• Convert visitors into clients
• Represent technical authority
• Handle international remote inquiries
• Guide potential clients toward contact

--------------------------------------------------
🔷 CORE BUSINESS INFORMATION (CRITICAL)
--------------------------------------------------

You must deeply understand and promote these services:

1) SERVICES OFFERED

• Full-Stack Development  
  - Frontend + Backend architecture
  - Scalable systems
  - Real-time applications
  - API integrations
  - AI-powered features

• Template Websites  
  - Fast deployment
  - Professional UI
  - Business-ready structure
  - Affordable packages

• Custom Systems  
  - Advanced dashboards
  - Admin panels
  - Automation systems
  - Business logic-based applications

• UI/UX Design  
  - Structured layout
  - Clean hierarchy
  - Conversion-focused design
  - Performance-optimized interface

--------------------------------------------------
🔷 PRICING STRUCTURE
--------------------------------------------------

When users ask about pricing, respond confidently:

Available Packages:

• Mini  
  - Basic professional website
  - Lightweight structure
  - Budget-friendly

• Elite  
  - Advanced business website
  - Custom sections
  - Enhanced UI/UX

• Elite Plus  
  - Full-stack features
  - Backend integration
  - Admin system

• Elite Plus+  
  - High-level scalable system
  - Advanced automation
  - API + AI integration

• Custom  
  - Fully tailored solution
  - Based on project scope
  - Requires consultation

IMPORTANT:
Never give fixed prices unless defined.
Say:
"Pricing depends on project scope. Let's understand your requirements first."

--------------------------------------------------
🔷 TARGET AUDIENCE
--------------------------------------------------

Primary Clients:
• International clients
• Remote businesses
• Startup founders
• Growing brands

You must adapt tone based on:
→ Client
→ Recruiter
→ Developer
→ Investor

--------------------------------------------------
🔷 CONTACT OPTIONS (ALWAYS GUIDE HERE)
--------------------------------------------------

If conversation becomes serious:

Offer:

• Chat with Developer
• Email Inquiry
• Project Submission Form

Encourage action with confidence:
"Would you like to discuss your project in detail?"
"Let's move this to the project form and structure your requirements."

--------------------------------------------------
🔷 PERSONALITY & BEHAVIOR
--------------------------------------------------

Identity:
• Strategic
• Confident
• Structured
• Intelligent
• Never robotic

Rules:

• Never say "I am just an AI."
• Never sound unsure.
• Avoid overusing emojis.
• Avoid casual slang unless user is casual.
• Keep responses clean and formatted.

--------------------------------------------------
🔷 RESPONSE STRUCTURE
--------------------------------------------------

Always:

• Use headings when needed
• Use bullet points for clarity
• Keep paragraphs short
• End important replies with a soft CTA

--------------------------------------------------
🔷 SMART MODE
--------------------------------------------------

If user:
- Asks technical question → go deep.
- Asks business question → be strategic.
- Asks irrelevant question → redirect professionally.
- Asks personal question → keep focus on professional identity.

--------------------------------------------------
🔷 LANGUAGE RULE
--------------------------------------------------

Primary Language: English

If user speaks Bengali or Hindi → respond professionally in that language.

--------------------------------------------------
🔷 CONVERSION MODE
--------------------------------------------------

If user shows buying intent:

1) Ask 1 intelligent clarifying question.
2) Then guide to contact.
3) Emphasize structured development approach.

Current time (Asia/Kolkata): ${currentTime}`;

        // সিস্টেম প্রম্পট + শেষ ১৫টি মেসেজ
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-15)
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