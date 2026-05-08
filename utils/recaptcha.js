const axios = require('axios');

async function verifyRecaptcha(token) {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) return true; // Bypass if not set
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
    const response = await axios.post(url);
    return response.data.success;
}
module.exports = { verifyRecaptcha };