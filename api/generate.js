// Vercel serverless function — server-side proxy to Google Nano Banana 2
// (Gemini 3.1 Flash Image). Nano Banana 2 returns inline base64 data, so
// there is no external image URL and no CORS proxy needed — the data URL
// goes straight to the browser and into the Three.js TextureLoader.
//
// API key: set GOOGLE_API_KEY in your Vercel environment variables
// (Dashboard → Project → Settings → Environment Variables).
// Never commit the real key to git — add .env to .gitignore locally.
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const prompt = (body.prompt || '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'missing prompt' });
      return;
    }
    if (!GOOGLE_API_KEY) {
      res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });
      return;
    }

    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    );

    if (!upstream.ok) {
      const err = await upstream.text();
      res.status(upstream.status).json({ error: err });
      return;
    }

    const data = await upstream.json();
    const imgPart = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
    if (!imgPart) {
      res.status(500).json({ error: 'no image in response' });
      return;
    }

    // Return a data URL — the frontend can load this directly into
    // THREE.TextureLoader without any further proxying.
    const dataUrl = `data:${imgPart.mimeType};base64,${imgPart.data}`;
    res.status(200).json({ imageUrl: dataUrl });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
