const express = require('express');
const corsMiddleware = require('./cors');
const { admin } = require('./firebase');
const { getCloudinaryConfig } = require('./cloudinary');
const { getSiteKey } = require('./recaptcha');
const publicApi = require('./public api');
const scripts = require('./script');

const app = express();
app.use(corsMiddleware);
app.use(express.json());

// Auth Middleware
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = await admin.auth().verifyIdToken(token);
        next();
    } catch (e) {
        res.status(401).json({ error: 'Unauthorized token' });
    }
};

// 1. Config Route (Passes non-sensitive keys to frontend)
app.get('/api/config', (req, res) => {
    res.json({
        recaptchaSiteKey: getSiteKey(),
        ...getCloudinaryConfig()
    });
});

// 2. Portfolio & Samples
app.get('/api/portfolio', async (req, res) => {
    try { res.json(await scripts.getMainData()); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/samples', async (req, res) => {
    try { res.json(await scripts.getPublicSamples()); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, recaptcha } = req.body;
        const data = await scripts.loginUser(email, password, recaptcha);
        res.json({ token: data.idToken, uid: data.localId, email: data.email });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name, profilePic, recaptcha } = req.body;
        const data = await scripts.signupUser(email, password, name, profilePic, recaptcha);
        res.json({ token: data.idToken, uid: data.localId, email: data.email });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/auth/reset', async (req, res) => {
    try {
        await scripts.resetPassword(req.body.email);
        res.json({ success: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// 4. Admin Chat (Protected)
app.get('/api/chat/messages', authenticate, async (req, res) => {
    try { res.json(await scripts.getMessages(req.user.uid)); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chat/message', authenticate, async (req, res) => {
    try {
        await scripts.saveMessage(req.user.uid, req.user.email, req.body.text);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Bot Chat
app.post('/api/chat/bot', async (req, res) => {
    try {
        const reply = await scripts.processBotMessage(req.body.history);
        res.json({ reply });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Proxied Public APIs
app.get('/api/public/countries', async (req, res) => {
    try { res.json(await publicApi.getCountries()); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/public/ip', async (req, res) => {
    try { res.json(await publicApi.getIP()); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/public/rates', async (req, res) => {
    try { res.json(await publicApi.getExchangeRates()); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export Express App for Vercel
module.exports = app;

// Local Development Server
if (require.main === module) {
    app.listen(3000, () => console.log('Server running on port 3000'));
}
