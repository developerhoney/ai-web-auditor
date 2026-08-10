require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const http = require('http');
const https = require('https');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse multi-keys from GEMINI_API_KEYS or single fallback GEMINI_API_KEY
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

let keyIndex = 0;

function getNextAiClient() {
    if (apiKeys.length === 0) return null;
    const selectedKey = apiKeys[keyIndex];
    keyIndex = (keyIndex + 1) % apiKeys.length;
    return new GoogleGenAI({ apiKey: selectedKey });
}

async function generateAiInsights(prompt) {
    if (apiKeys.length === 0) {
        return 'No Gemini API keys found in Environment Variables.';
    }

    let lastError = null;

    for (let attempts = 0; attempts < apiKeys.length; attempts++) {
        try {
            const ai = getNextAiClient();
            const aiResponse = await ai.models.generateContent({
                model: 'gemini-1.5-flash', // Updated to 1.5-flash for compatibility
                contents: prompt,
            });
            return aiResponse.text;
        } catch (err) {
            console.warn(`[AI Key Rotation] Key attempt ${attempts + 1} failed. Failover to next key...`);
            lastError = err;
        }
    }

    // Backend logs ke liye real error save karein (Sirf aapko Render par dikhega)
    console.error("[AI Error]:", lastError?.message || 'Rate limit reached');
    
    // Website users ko ye clean message dikhega (Security fix)
    return "AI recommendations are temporarily unavailable due to high server load. Please try again in a few moments.";
}

const httpAgent = new http.Agent({ maxHeaderSize: 131072 });
const httpsAgent = new https.Agent({ maxHeaderSize: 131072 });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/audit', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        const startTime = Date.now();

        const response = await axios.get(url, {
            httpAgent,
            httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: () => true
        });

        const loadTimeMs = Date.now() - startTime;
        const $ = cheerio.load(response.data || '');

        const title = $('title').text().trim() || 'No Title Found';
        const metaDescription = $('meta[name="description"]').attr('content') || 'Missing Meta Description';
        const h1Tags = $('h1').map((_, el) => $(el).text().trim()).get();
        const images = $('img');
        let imagesMissingAlt = 0;

        images.each((_, el) => {
            if (!$(el).attr('alt')) imagesMissingAlt++;
        });

        const isHttps = url.startsWith('https://');

        let seoScore = 100;
        if (title === 'No Title Found') seoScore -= 20;
        if (metaDescription === 'Missing Meta Description') seoScore -= 20;
        if (h1Tags.length === 0) seoScore -= 15;
        if (imagesMissingAlt > 0) seoScore -= 10;
        if (!isHttps) seoScore -= 20;
        if (loadTimeMs > 2000) seoScore -= 15;
        seoScore = Math.max(0, seoScore);

        const prompt = `Analyze this web page audit metadata and provide 3 quick bullet points for improvement:
        URL: ${url}
        Title: ${title}
        Meta Description: ${metaDescription}
        H1 Count: ${h1Tags.length}
        Total Images: ${images.length} (Missing Alt: ${imagesMissingAlt})
        Load Time: ${loadTimeMs}ms
        HTTPS: ${isHttps}`;

        const aiAnalysis = await generateAiInsights(prompt);

        return res.json({
            success: true,
            url,
            statusCode: response.status || 200,
            metrics: { seoScore, loadTimeMs, isHttps },
            seo: { title, metaDescription, h1Count: h1Tags.length, totalImages: images.length, imagesMissingAlt },
            aiAnalysis
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message || 'Server error during audit sequence'
        });
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));