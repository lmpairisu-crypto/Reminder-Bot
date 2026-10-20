require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  console.log(`🧠 Gemini AI Scanner initialized — Model: ${GEMINI_MODEL}`);
} else {
  console.warn("⚠️ GEMINI_API_KEY not set — AI scanning will be skipped.");
}

async function scanImage(imageUrl, prompt) {
  if (!model) {
    return { status: "unknown", serious: false, reason: "AI scanner not configured." };
  }

  try {
    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          fileUri: imageUrl,
          mimeType: "image/png",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { status: "unknown", serious: false, reason: "Could not parse AI response." };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("❌ Gemini scan failed:", error.message);
    return { status: "unknown", serious: false, reason: "Scan error." };
  }
}

async function scanText(text, prompt) {
  if (!model) {
    return { allowed: true, serious: false, reason: "AI scanner not configured." };
  }

  try {
    const fullPrompt = `${prompt}\n\nMessage: """${text}"""`;
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const output = response.text();
    
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { allowed: true, serious: false, reason: "Could not parse response." };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("❌ Gemini text scan failed:", error.message);
    return { allowed: true, serious: false, reason: "Scan error." };
  }
}

module.exports = { scanImage, scanText };
