// Vercel serverless function — server-side proxy to Ablo AI image generation.
// Ablo returns an external CDN image URL; we fetch it server-side and return
// a base64 data URL so the browser never hits a CORS issue.
//
// API key: set ABLO_API_KEY in your Vercel environment variables
// (Dashboard → Project → Settings → Environment Variables).
// Never commit the real key to git — add .env to .gitignore locally.
const ABLO_API_KEY  = process.env.ABLO_API_KEY || '';
const ABLO_ENDPOINT = 'https://virtual-tryserver-production.up.railway.app/api/v1/images';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  try {
    const body   = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const prompt = (body.prompt || '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'missing prompt' });
      return;
    }
    if (!ABLO_API_KEY) {
      res.status(500).json({ error: 'ABLO_API_KEY not configured' });
      return;
    }

    // 1 — Ablo image generation request
    const upstream = await fetch(ABLO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ABLO_API_KEY,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      res.status(upstream.status).json({ error: err });
      return;
    }

    const data = await upstream.json();

    // Ablo response shape: { success: true, data: { images: [{ url: "..." }] } }
    const imageUrl = data?.data?.images?.[0]?.url
      || data?.url || data?.imageUrl || data?.image_url
      || data?.images?.[0]?.url;

    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(500).json({ error: 'no image URL in Ablo response: ' + JSON.stringify(data) });
      return;
    }

    // 2 — Fetch the actual image server-side (avoids CORS on the CDN URL)
    //     and convert to base64 data URL so Three.js can load it directly.
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      // Fall back to returning the raw URL — frontend can try loading it directly
      res.status(200).json({ imageUrl });
      return;
    }
    const mimeType  = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer    = await imgRes.arrayBuffer();
    const base64    = Buffer.from(buffer).toString('base64');
    const dataUrl   = `data:${mimeType};base64,${base64}`;

    res.status(200).json({ imageUrl: dataUrl });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
