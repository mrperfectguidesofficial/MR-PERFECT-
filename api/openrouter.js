const axios = require('axios');

module.exports = {
    chatWithBot: async (messages) => {
        try {
            const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: process.env.OPENROUTER_MODEL || "openrouter/free",
                messages: messages,
                temperature: 0.75,
                max_tokens: 600
            }, {
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });
            return res.data.choices[0].message.content;
        } catch (error) {
            console.error('OpenRouter Error:', error);
            throw new Error("Failed to connect to AI");
        }
    }
};