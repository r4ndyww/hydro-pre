const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { DynamicRetrievalMode, GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const axios = require('axios');
const Groq = require('groq-sdk');
const { HfInference } = require('@huggingface/inference');
const app = express();
const port = 3000;

mongoose.connect('mongodb+srv://randyyuankurnianto20:Randyyyyy2009@rynn-archive.akfzq.mongodb.net/AI-Database?retryWrites=true&w=majority&appName=Rynn-Archive', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const aiSchema = new mongoose.Schema({
    ainame: { type: String, required: true, unique: true },
    systemInstruction: { type: String, required: true },
});

const AI = mongoose.model('AI', aiSchema);

const apiKey = 'AIzaSyAJF_keuCClc3oDmOjDeB5wiRATggbHCak';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_API_KEY = 'Cj3IYpkG01eLI46pIwxVMjtjjBqPGWOr';
const mistralRegex = /(mistral|mixtral|pixtral|ministral|codestral)/i;

const HF_API_KEY = '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';
const hf = new HfInference(HF_API_KEY);

const groq = new Groq({ apiKey: "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" });

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/create-ai', express.static(path.join(__dirname, 'create-ai')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());

async function HuggingFace(prompt, model) {
    try {
        const response = await hf.textGeneration({
            model: model,
            inputs: prompt,
            parameters: {
                max_new_tokens: 150,
                temperature: 0.7,
                top_p: 0.9,
            },
        });
        return response.generated_text;
    } catch (error) {
        throw new Error(`Error calling Hugging Face API: ${error.message}`);
    }
}

async function GroqApi(query, model) {
    return groq.chat.completions.create({
        messages: [
            {
                role: "user",
                content: query,
            },
        ],
        model: model,
        temperature: 0.5,
        max_tokens: 1024,
        top_p: 1,
        stop: null,
        stream: false,
    });
};

async function MistralAI(messages, model) {
    try {
        const response = await axios.post(MISTRAL_API_URL, {
            model: model,
            messages: messages,
            temperature: 0.7,
            top_p: 1,
            max_tokens: 150,
            presence_penalty: 0,
            frequency_penalty: 0,
            n: 1,
            safe_prompt: false,
        }, {
            headers: {
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(`Error calling Mistral AI: ${error.message}`);
    }
}

async function BingAI(prompt) {
    try {
        const response = await axios.get(`https://loco.web.id/wp-content/uploads/api/v1/bingai.php?q=${prompt}`);
        const data = response.data;
        if (data.status) {
            const citations = data.result.search_results
                .map(result => `[${result.index}] ${result.url}`);
            return {
                result: data.result.ai_response,
                citations: citations
            };
        } else {
            throw new Error('Bing AI API call failed');
        }
    } catch (error) {
        throw new Error(`Error calling Bing AI: ${error.message}`);
    }
}

async function cimg(prompt) {
    try {
        const response = await axios.get(`https://imgen.duck.mom/prompt/${prompt}`);
        const imageUrl = response.request.res.responseUrl;
        return imageUrl;
    } catch (error) {
        throw new Error(`${error.message}`);
    }
}

app.post('/api/process', upload.single('file'), async (req, res) => {
    const { prompt, model, system } = req.body;
    const file = req.file;
    try {
        let response;
        const selectedModel = model || 'gemini-1.5-flash';
        if (selectedModel === 'bing-ai') {
            const bingResponse = await BingAI(prompt);
            response = bingResponse.result;
            const citations = bingResponse.citations;
            response += '\n\nCitations:\n' + citations.join('\n');
            res.json({ result: response });
        } else if (mistralRegex.test(selectedModel)) {
            const messages = [
                {
                    role: 'user',
                    content: prompt,
                },
            ];
            response = await MistralAI(messages, selectedModel);
            res.json({ result: response.choices[0].message.content });
        } else if (selectedModel === 'gemma-7b-it' || selectedModel === 'gemma2-9b-it') {
            response = await GroqApi(prompt, selectedModel);
            res.json({ result: response.choices[0]?.message?.content || "" });
        } else if (selectedModel === 'cimg') {
            response = await cimg(prompt);
            res.json({ result: response });
        } else if (selectedModel === 'custom-prompt') {
            if (file) {
                const mime = file.mimetype;
                const filePath = file.path;
                if (/image/.test(mime) || /video/.test(mime) || /audio/.test(mime) || /application\/pdf/.test(mime)) {
                    const modelInstance = genAI.getGenerativeModel({
                        model: 'gemini-1.5-flash',
                        systemInstruction: system
                    });
                    const uploadResponse = await fileManager.uploadFile(filePath, {
                        mimeType: mime,
                        displayName: `temp_file_${Date.now()}`,
                    });
                    fs.unlinkSync(filePath);
                    response = await modelInstance.generateContent([
                        {
                            fileData: {
                                mimeType: uploadResponse.file.mimeType,
                                fileUri: uploadResponse.file.uri,
                            },
                        },
                        { text: prompt },
                    ]);
                    res.json({ result: response.response.text() });
                } else {
                    res.status(400).json({ error: 'Unsupported file type' });
                }
            } else {
                const modelInstance = genAI.getGenerativeModel({
                    model: 'gemini-1.5-flash',
                    systemInstruction: system
                });
                response = await modelInstance.generateContent(prompt);
                res.json({ result: response.response.text() });
            }
        } else {
            if (file) {
                const mime = file.mimetype;
                const filePath = file.path;
                if (/image/.test(mime) || /video/.test(mime) || /audio/.test(mime) || /application\/pdf/.test(mime)) {
                    const modelInstance = genAI.getGenerativeModel({
                        model: selectedModel,
                    });
                    const uploadResponse = await fileManager.uploadFile(filePath, {
                        mimeType: mime,
                        displayName: `temp_file_${Date.now()}`,
                    });
                    fs.unlinkSync(filePath);
                    response = await modelInstance.generateContent([
                        {
                            fileData: {
                                mimeType: uploadResponse.file.mimeType,
                                fileUri: uploadResponse.file.uri,
                            },
                        },
                        { text: prompt },
                    ]);
                    res.json({ result: response.response.text() });
                } else {
                    res.status(400).json({ error: 'Unsupported file type' });
                }
            } else {
                const modelInstance = genAI.getGenerativeModel({
                    model: selectedModel,
                });
                response = await modelInstance.generateContent(prompt);
                res.json({ result: response.response.text() });
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/create-ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'create-ai', 'index.html'));
});

app.get('/created/:ainame', async (req, res) => {
    const { ainame } = req.params;
    if (!ainame) {
        return res.status(404).sendFile(process.cwd() + "/public/404.html")
    }
    const ai = await AI.findOne({ ainame });
    if (!ai) {
        return res.status(404).sendFile(process.cwd() + "/public/404.html")
    }
    res.sendFile(path.join(__dirname, 'created-ai', 'index.html'));
});

app.post('/api/create-ai', async (req, res) => {
    const { ainame, systemInstruction } = req.body;
    if (!ainame || !systemInstruction) {
        return res.status(400).json({ error: 'All data must be filled in.' });
    }
    try {
        const newAI = new AI({ ainame, systemInstruction });
        await newAI.save();
        res.status(201).json({
            endpoint: `/created/${ainame}`,
        });
    } catch (err) {
        if (err.code === 11000) {
            res.status(400).json({ error: 'AI name already exists, please choose another name.' });
        } else {
            res.status(500).json({ error: 'An error occurred on the server.' });
        }
    }
});

app.post('/api/:ainame', upload.single('file'), async (req, res) => {
    const { ainame } = req.params;
    const { prompt } = req.body;
    const file = req.file;
    try {
        const ai = await AI.findOne({ ainame });
        if (!ai) {
            return res.status(404).json({ error: 'AI not found.' });
        }
        const systemInstruction = ai.systemInstruction;
        let response;
        if (file) {
            const mime = file.mimetype;
            const filePath = file.path;
            if (/image/.test(mime) || /video/.test(mime) || /audio/.test(mime) || /application\/pdf/.test(mime)) {
                const modelInstance = genAI.getGenerativeModel({
                    model: 'gemini-1.5-flash',
                    systemInstruction,
                });
                const uploadResponse = await fileManager.uploadFile(filePath, {
                    mimeType: mime,
                    displayName: `temp_file_${Date.now()}`,
                });
                fs.unlinkSync(filePath);
                response = await modelInstance.generateContent([
                    {
                        fileData: {
                            mimeType: uploadResponse.file.mimeType,
                            fileUri: uploadResponse.file.uri,
                        },
                    },
                    { text: prompt },
                ]);
                res.json({ result: response.response.text() });
            } else {
                res.status(400).json({ error: 'Unsupported file type' });
            }
        } else {
            const modelInstance = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                systemInstruction,
            });
            response = await modelInstance.generateContent(prompt);
            res.json({ result: response.response.text() });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

app.use((req, res, next) => {
    res.status(404).sendFile(process.cwd() + "/public/404.html")
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(process.cwd() + "/public/500.html")
});

app.listen(port, () => {
    console.log(`Hydro AI running at http://localhost:${port}`);
});
