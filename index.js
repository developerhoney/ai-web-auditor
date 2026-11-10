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

// Support multiple keys (comma separated) or single key
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
    return 'No Gemini API key found. Add GEMINI_API_KEY in environment variables.';
  }

  let lastError = null;

  for (let attempts = 0; attempts < apiKeys.length; attempts++) {
    try {
      const ai = getNextAiClient();
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
      });
      return aiResponse.text;
    } catch (err) {
      console.warn(`[AI] Key attempt ${attempts + 1} failed:`, err.message);
      lastError = err;
    }
  }

  console.error('[AI Error]:', lastError?.message || 'Unknown error');
  return 'AI recommendations are temporarily unavailable. Please try again in a few moments.';
}

const httpAgent = new http.Agent({ maxHeaderSize: 131072 });
const httpsAgent = new https.Agent({ maxHeaderSize: 131072 });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/audit', async (req, res) => {
  try {
    let { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Auto-add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const startTime = Date.now();

    const response = await axios.get(url, {
      httpAgent,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
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
      if (!$(el).attr('alt') || $(el).attr('alt').trim() === '') {
        imagesMissingAlt++;
      }
    });

    const isHttps = url.startsWith('https://');

    // SEO Score calculation
    let seoScore = 100;
    if (title === 'No Title Found') seoScore -= 20;
    if (metaDescription === 'Missing Meta Description') seoScore -= 20;
    if (h1Tags.length === 0) seoScore -= 15;
    if (h1Tags.length > 1) seoScore -= 5;
    if (imagesMissingAlt > 0) seoScore -= Math.min(15, imagesMissingAlt * 3);
    if (!isHttps) seoScore -= 20;
    if (loadTimeMs > 3000) seoScore -= 15;
    else if (loadTimeMs > 1500) seoScore -= 8;
    seoScore = Math.max(0, Math.min(100, seoScore));

    // Performance score based on load time
    let performanceScore = 100;
    if (loadTimeMs > 4000) performanceScore = 35;
    else if (loadTimeMs > 2500) performanceScore = 55;
    else if (loadTimeMs > 1500) performanceScore = 75;
    else if (loadTimeMs > 800) performanceScore = 88;
    else if (loadTimeMs > 400) performanceScore = 95;

    const prompt = `You are a senior web performance & SEO expert.
Analyze this page and give exactly 3 short, actionable improvement points in simple language (Hindi + English mix is fine if natural).
Keep each point under 20 words.

URL: ${url}
Title: ${title}
Meta Description: ${metaDescription}
H1 Count: ${h1Tags.length}
Total Images: ${images.length}
Images Missing Alt: ${imagesMissingAlt}
Load Time: ${loadTimeMs}ms
HTTPS: ${isHttps}
SEO Score: ${seoScore}/100

Format:
• Point 1
• Point 2
• Point 3`;

    const aiAnalysis = await generateAiInsights(prompt);

    return res.json({
      success: true,
      url,
      statusCode: response.status || 200,
      metrics: {
        seoScore,
        performanceScore,
        loadTimeMs,
        isHttps
      },
      seo: {
        title,
        metaDescription,
        h1Count: h1Tags.length,
        totalImages: images.length,
        imagesMissingAlt
      },
      aiAnalysis
    });

  } catch (error) {
    console.error('Audit error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to audit this URL. Please check if the website is accessible.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI Web Auditor running at http://localhost:${PORT}`);
});
