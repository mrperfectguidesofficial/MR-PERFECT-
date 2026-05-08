const axios = require('axios');

async function getExchangeRate(currency) {
    try {
        const res = await axios.get(`https://open.er-api.com/v6/latest/USD`);
        return res.data.rates[currency] || 1;
    } catch (e) { return 1; }
}

module.exports = { getExchangeRate };