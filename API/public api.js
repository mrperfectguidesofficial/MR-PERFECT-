const axios = require('axios');

module.exports = {
    getCountries: async () => {
        const res = await axios.get("https://restcountries.com/v3.1/all?fields=name,cca2,currencies");
        return res.data;
    },
    getIP: async () => {
        const res = await axios.get("https://ipapi.co/json/");
        return res.data;
    },
    getExchangeRates: async () => {
        const res = await axios.get("https://open.er-api.com/v6/latest/USD");
        return res.data;
    }
};