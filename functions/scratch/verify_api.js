const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testGemini() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Using key:", key ? "Key found" : "Key NOT found");
    if (!key) return;

    const genAI = new GoogleGenerativeAI(key);
    
    try {
        console.log("Testing with gemini-flash-latest...");
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const result = await model.generateContent("Olá, responda apenas 'OK' se você estiver funcionando.");
        console.log("Resposta:", result.response.text());
    } catch (error) {
        console.error("Erro:", error.message);
    }
}

testGemini();
