const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const key = 'AIzaSyB2UUICNODqwDB7xUk1Iq1enA3qU-D8OMA';
    const genAI = new GoogleGenerativeAI(key);
    
    try {
        // Note: The library doesn't have a direct listModels method on the genAI object usually, 
        // it's an API call. But let's try a different model name.
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent("Hi");
        console.log(result.response.text());
    } catch (error) {
        console.error("Erro:", error.message);
    }
}

listModels();
