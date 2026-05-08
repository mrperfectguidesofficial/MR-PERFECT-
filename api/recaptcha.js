const axios = require('axios');

module.exports = {
    verifyRecaptcha: async (token) => {
        const secret = process.env.RECAPTCHA_SECRET_KEY;
        if (!secret) return true; // Bypass if not configured
        
        try {
            const res = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`);
            return res.data.success;
        } catch (error) {
            console.error('reCAPTCHA Error:', error);
            return false;
        }
    },
    getSiteKey: () => process.env.RECAPTCHA_SITE_KEY
};