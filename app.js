const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const stringSimilarity = require('string-similarity');
const natural = require('natural');
const { TfIdf } = natural;
const tokenizer = new natural.WordTokenizer();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let conversationHistory = [];

const configSave = {
    dataSet: true // true save to database.json | flse dont save to database.json
};

function loadDatabase() {
    try {
        const data = fs.readFileSync('database.json');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading database:', err);
        return { data: [] };
    }
}

function saveToDatabase(question, answer) {
    const db = loadDatabase();
    db.data.push({ question, answer });
    fs.writeFileSync('database.json', JSON.stringify(db, null, 2));
}

async function fetchResponseFromAPI(question) {
    try {
        const customPrompt = 'Kamu harus berpura-pura menjadi DevBot sebagai AI yang dikembangkan oleh I-As.Dev jawab pertanyaan dengan singkat dan spesifik. ' + question;
        const response = await axios.get(`https://api.i-as.dev/api/gemini/${encodeURIComponent(customPrompt)}`);
        return response.data.text;
    } catch (error) {
        console.error('Error fetching data from API:', error);
        return null;
    }
}

function findSimilarQuestion(input) {
    const db = loadDatabase();
    const tfidf = new TfIdf();

    db.data.forEach(item => {
        tfidf.addDocument(item.question);
    });

    const inputTokens = tokenizer.tokenize(input);
    let bestMatch = null;

    db.data.forEach(item => {
        const itemTokens = tokenizer.tokenize(item.question);
        const similarity = stringSimilarity.compareTwoStrings(input, item.question);
        const commonTokens = inputTokens.filter(token => itemTokens.includes(token));
        const tokenSimilarity = (commonTokens.length / inputTokens.length) * 100;

        if (similarity >= 0.90 || tokenSimilarity >= 90) {
            bestMatch = item;
        }
    });

    return bestMatch;
}

async function getResponse(input) {
    conversationHistory.push(input);
    
    const similarQuestion = findSimilarQuestion(input);
    if (similarQuestion) {
        return { response: similarQuestion.answer, savedToDb: true };
    } else {
        const apiResponse = await fetchResponseFromAPI(input);
        if (apiResponse) {
            const newSimilarQuestion = findSimilarQuestion(input);
            if (!newSimilarQuestion) {
                if (configSave.dataSet) {
                    saveToDatabase(input, apiResponse);
                    return { response: apiResponse, savedToDb: true };
                } else {
                    return { response: apiResponse, savedToDb: false };
                }
            }
        }
        return { response: 'Sorry, I could not find an answer.', savedToDb: false };
    }
}

app.post('/api/chat', async (req, res) => {
    const userInput = req.body.input;
    if (!userInput) {
        return res.status(400).json({ error: 'Input is required.' });
    }

    const { response, savedToDb } = await getResponse(userInput.toLowerCase());
    res.json({ response, savedToDb });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
