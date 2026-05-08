// Dynamic Pricing calculation logic hidden from frontend
async function calculateCustomPrice(baseUsd, targetCurrency) {
    const { getExchangeRate } = require('./public_api');
    let rate = 1;
    if (targetCurrency !== 'USD') {
        rate = await getExchangeRate(targetCurrency);
    }
    return {
        currency: targetCurrency,
        price: Math.round(baseUsd * rate),
        basePrice: baseUsd
    };
}

module.exports = { calculateCustomPrice };