const axios = require('axios');

async function askOpenRouter(messages) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = "https://openrouter.ai/api/v1/chat/completions";
    
    const response = await axios.post(url, {
        model: "openrouter/free",
        messages: messages,
        temperature: 0.75,
        max_tokens: 600
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });

    return response.data.choices[0].message.content;
}
module.exports = { askOpenRouter };