const synaptic = require('synaptic');
const readline = require('readline');
const fs = require('fs');
const axios = require('axios');
const stringSimilarity = require('string-similarity'); // Mengimpor string-similarity
const natural = require('natural'); // Mengimpor natural untuk analisis teks
const TfIdf = natural.TfIdf;

// Membuat layer untuk jaringan saraf
const Layer = synaptic.Layer;
const Network = synaptic.Network;
const Architect = synaptic.Architect;

// Membuat arsitektur jaringan saraf
const inputLayer = new Layer(2); // Layer input dengan 2 neuron (fitur)
const hiddenLayer = new Layer(3); // Layer tersembunyi dengan 3 neuron
const outputLayer = new Layer(1); // Layer output dengan 1 neuron

// Menghubungkan layer
inputLayer.project(hiddenLayer);
hiddenLayer.project(outputLayer);

// Membuat jaringan
const myNetwork = new Network({
    input: inputLayer,
    hidden: [hiddenLayer],
    output: outputLayer
});

// Fungsi untuk melatih model
function trainModel(data) {
    const trainingData = data.map(item => ({
        input: [item.input[0], item.input[1]],
        output: [item.output]
    }));

    trainingData.forEach(item => {
        myNetwork.activate(item.input); // Mengaktifkan jaringan
        myNetwork.propagate(0.1, item.output); // Melatih jaringan
    });
}

// Fungsi untuk mengambil data dari database lokal
function loadDatabase() {
    try {
        const data = fs.readFileSync('database.json');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading database:', err);
        return { data: [] };
    }
}

// Fungsi untuk menyimpan pertanyaan dan jawaban ke database
function saveToDatabase(question, answer) {
    const db = loadDatabase();
    db.data.push({ question, answer });
    fs.writeFileSync('database.json', JSON.stringify(db, null, 2));
}

// Fungsi untuk mendapatkan respons dari API
async function fetchResponseFromAPI(question) {
    try {
        const response = await axios.get(`https://api.i-as.dev/api/gemini/${encodeURIComponent(question)}`);
        return response.data.text; // Mengambil jawaban dari API
    } catch (error) {
        console.error('Error fetching data from API:', error);
        return null; // Mengembalikan null jika terjadi kesalahan
    }
}

// Fungsi untuk mencari pertanyaan mirip menggunakan TF-IDF dan string similarity
function findSimilarQuestion(input) {
    const db = loadDatabase();
    const tfidf = new TfIdf();
    
    // Menambahkan semua pertanyaan ke dalam TF-IDF
    db.data.forEach(item => {
        tfidf.addDocument(item.question);
    });

    // Hitung vektor input untuk TF-IDF
    const inputVector = tfidf.tfidfs(input, (i, measure) => measure);
    let highestSimilarity = 0;
    let bestMatch = null;

    // Cek kesamaan menggunakan string-similarity
    db.data.forEach(item => {
        const similarity = stringSimilarity.compareTwoStrings(input, item.question);
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = item;
        }
    });

    return highestSimilarity >= 0.90 ? bestMatch : null; // Mengembalikan pertanyaan yang mirip jika >= 90% serupa
}

// Fungsi untuk memberikan respons
async function getResponse(input) {
    const similarQuestion = findSimilarQuestion(input);

    if (similarQuestion) {
        return similarQuestion.answer; // Mengambil jawaban dari pertanyaan yang mirip
    } else {
        // Jika tidak ada pertanyaan mirip, ambil jawaban dari API
        const apiResponse = await fetchResponseFromAPI(input);
        if (apiResponse) {
            saveToDatabase(input, apiResponse); // Menyimpan pertanyaan dan jawaban baru hanya jika tidak ada error
        }
        return apiResponse || 'Sorry, I could not find an answer.'; // Mengembalikan jawaban dari API atau pesan kesalahan
    }
}

// Fungsi untuk memulai interaksi dengan pengguna
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Mulai interaksi
async function chat() {
    rl.question('Anda: ', async (userInput) => {
        const input = userInput.toLowerCase();
        const response = await getResponse(input); // Dapatkan respons
        console.log('Chatbot:', response);
        chat(); // Mulai interaksi lagi
    });
}

// Mulai chat
chat();
