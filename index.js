require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 12000,
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

        // Score Calculation
        let seoScore = 100;
        if (title === 'No Title Found') seoScore -= 20;
        if (metaDescription === 'Missing Meta Description') seoScore -= 20;
        if (h1Tags.length === 0) seoScore -= 15;
        if (imagesMissingAlt > 0) seoScore -= 10;
        if (!isHttps) seoScore -= 20;
        if (loadTimeMs > 2000) seoScore -= 15;
        seoScore = Math.max(0, seoScore);

        // AI Analysis
        let aiAnalysis = 'AI API Key not configured in .env file.';
        if (process.env.GEMINI_API_KEY) {
            try {
                const prompt = `Analyze this web page audit metadata and provide 3 quick bullet points for improvement:
                URL: ${url}
                Title: ${title}
                Meta Description: ${metaDescription}
                H1 Count: ${h1Tags.length}
                Total Images: ${images.length} (Missing Alt: ${imagesMissingAlt})
                Load Time: ${loadTimeMs}ms
                HTTPS: ${isHttps}`;

                const aiResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });
                aiAnalysis = aiResponse.text;
            } catch (aiErr) {
                aiAnalysis = 'AI analysis unavailable: ' + aiErr.message;
            }
        }

        // Standardized JSON Output
        return res.json({
            success: true,
            url: url,
            statusCode: response.status || 200,
            metrics: {
                seoScore: seoScore,
                loadTimeMs: loadTimeMs,
                isHttps: isHttps
            },
            seo: {
                title: title,
                metaDescription: metaDescription,
                h1Count: h1Tags.length,
                totalImages: images.length,
                imagesMissingAlt: imagesMissingAlt
            },
            aiAnalysis: aiAnalysis
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message || 'Server error during audit sequence'
        });
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));