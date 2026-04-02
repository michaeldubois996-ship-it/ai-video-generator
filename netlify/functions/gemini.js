// netlify/functions/gemini.js
// ─────────────────────────────────────────────────────────────────────────────
// Proxy serverless entre l'app React et l'API Gemini.
// Tourne côté serveur → pas de CORS, clé API protégée.
// Déploiement : Netlify Functions (gratuit — 125 000 appels/mois)
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  // ── CORS headers pour autoriser l'app à appeler cette fonction ────────────
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Preflight OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }

  try {
    const { prompt, apiKey } = JSON.parse(event.body || "{}");

    if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: "Prompt manquant" }) };
    if (!apiKey)  return { statusCode: 400, headers, body: JSON.stringify({ error: "Clé API manquante" }) };

    // ── Appel vers Gemini (côté serveur = pas de CORS) ─────────────────────
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return {
        statusCode: geminiRes.status,
        headers,
        body: JSON.stringify({ error: data?.error?.message || `Gemini erreur ${geminiRes.status}` }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Erreur serveur" }),
    };
  }
};
                         
