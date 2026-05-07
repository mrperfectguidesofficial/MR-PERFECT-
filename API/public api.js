const axios = require('axios');

module.exports = {
    getCountries: async () => {
        // You could use RESTCOUNTRIES_API key here if required by a premium endpoint
        const res = await axios.get("https://restcountries.com/v3.1/all?fields=name,cca2,currencies");
        return res.data;
    },
    getIP: async () => {
        // Add IPAPI key if required
        const res = await axios.get("https://ipapi.co/json/");
        return res.data;
    },
    getExchangeRates: async () => {
        // Add EXCHANGE_RATE key if required
        const res = await axios.get("https://open.er-api.com/v6/latest/USD");
        return res.data;
    }
};