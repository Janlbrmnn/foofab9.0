// Vercel serverless function — image proxy. The generated image is hosted
// on a domain without CORS headers, so loading it directly into a WebGL
// texture taints it and it renders blank. This refetches the image
// server-side and streams it back same-origin (with permissive CORS),
// so THREE.js can use it cleanly.
export default async function handler(req, res) {
  try {
    const url = req.query && req.query.url;
    if (!url) { res.status(400).json({ error: 'missing url' }); return; }
    const upstream = await fetch(url);
    if (!upstream.ok) { res.status(upstream.status).end(); return; }
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
