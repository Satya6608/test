/* eslint-disable no-console */
const express = require("express");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");
const path = require("path");
const fs = require("fs");
const dayjs = require("dayjs");
const cors = require("cors");
const dotenv = require("dotenv");

// console.log(process.env.NUMBER_OF_PROCESSORS);
dotenv.config();

const upload = require("./multer-setup");

/* ---------- NEW: OpenAI client ---------- */
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY2,
});

const USE_OPENAI = /^true$/i.test(process.env.USE_OPENAI || true || "false");
const OPENAI_MODEL = process.env.OPENAI_MODEL;
/* ---------------------------------------- */

const app = express();
const PORT = process.env.PORT || 5174;
app.use(
  cors({
    origin: "http://localhost:5174",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
// app.use(cors());

/* ---------- YOUR REGEX PARSER (unchanged except small tweaks) ---------- */
function parseFlightTicketText(text) {
  const flights = [];
  const flightRegex = /AI\s*-\s*(\d+)[\s\S]+?(?=(?:AI\s*-\s*\d+|$))/g;
  const flightBlocks = [...text.matchAll(flightRegex)];

  for (const match of flightBlocks) {
    const block = match[0];
    const flightNumber = `AI${match[1]}`;

    const departMatch =
      /Departing\s+([\w, '\d]+,\s[\d:]+)[\s\S]+?([\w\s]+),\s+Terminal\s+(\w+)/.exec(
        block
      );
    const arriveMatch =
      /Arriving\s+([\w, '\d]+,\s[\d:]+)[\s\S]+?([\w\s]+),\s+Terminal\s+(\w+)/.exec(
        block
      );

    const departureTime = departMatch ? departMatch[1].trim() : null;
    const departureCity = departMatch
      ? `${departMatch[2].trim()}, Terminal ${departMatch[3]}`
      : null;
    const arrivalTime = arriveMatch ? arriveMatch[1].trim() : null;
    const arrivalCity = arriveMatch
      ? `${arriveMatch[2].trim()}, Terminal ${arriveMatch[3]}`
      : null;

    /* Passenger extraction */
    const passengerDetails = [];
    const passengerRegex =
      /(\d+)\s+(MR|MS)\s+([A-Z\s]+)\(\s*A\s*\)\s*,\s+([A-Z]{3})-([A-Z]{3})[\s\S]+?\(\s*(\d{10,13})\s*\)/g;
    let pMatch;
    while ((pMatch = passengerRegex.exec(block)) !== null) {
      passengerDetails.push({
        name: `${pMatch[2]} ${pMatch[3].trim()}`,
        passportNumber: pMatch[6],
        seatNumber: null,
        mealPreference: null,
      });
    }

    /* Push only if we found minimal data (flightNo + at least 1 passenger) */
    if (passengerDetails.length) {
      flights.push({
        flightDetails: {
          flightNumber,
          departureTime: convertToISO(departureTime),
          arrivalTime: convertToISO(arrivalTime),
          origin: departureCity,
          destination: arrivalCity,
          price: null,
        },
        passengerDetails,
      });
    }
  }
  return flights;
}
/* ---------------------------------------------------------------------- */

function convertToISO(dateStr) {
  if (!dateStr) return null;
  const parsed = dayjs(dateStr.replace(/'/g, ""), "ddd, D MMM YY, HH:mm");
  return parsed.isValid() ? parsed.toISOString() : null;
}

/* ---------- OCR / Image ---------- */
async function processImage(imagePath) {
  const result = await Tesseract.recognize(imagePath, "eng", {
    logger: (m) => console.log(m),
  });
  return {
    text: result.data.text,
    confidence: result.data.confidence,
    words: result.data.text.split(/\n+/),
  };
}

/* ---------- PDF → text → JSON ---------- */
async function processPDF(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const rawText = data.text;
  let flightTickets = [];

  /* ---------- NEW: fallback / enhancement via OpenAI ---------- */
  if (USE_OPENAI) {
    try {
      /* decide when to call LLM: if regex failed OR you always want GPT */
      const needLLM = rawText.trim().length > 0;
      if (needLLM) {
        console.log("⚠️  Falling back to OpenAI parsing…");
        flightTickets = await parseWithOpenAI(rawText);
      }
    } catch (e) {
      console.error("OpenAI parsing failed:", e.message);
    }
  }
  /* ------------------------------------------------------------ */

  return {
    flightTickets,
    rawText,
    lines: rawText.split(/\n+/),
    confidence: 97,
  };
}

/* ---------- NEW: OpenAI helper ---------- */
async function parseWithOpenAI(rawText) {
  const prompt = `
You are an AI that converts airline ticket text into structured JSON.

Desired schema:
[
  {
    "flightDetails": {
      "flightNumber": "AI102",
      "departureTime": "2025-07-12T04:55:00+05:30",
      "arrivalTime": "2025-07-12T10:35:00+02:00",
      "from": "Delhi",
      "to": "Paris",
      "origin": "Delhi, Terminal 3 (Indira Gandhi Intl)",
      "destination": "Paris, Terminal 2C (Charles De Gaulle Intl)",
      "price": null
    },
    "passengerDetails": [
      {
        "name": "MR SOHAM GOENKA",
        "passportNumber": "0982864320996",
        "seatNumber": "12A",
        "mealPreference": null
      }
    ]
  }
]

Output **ONLY** valid JSON. Do not wrap in markdown. If information is missing, use null. Here is the ticket text between the triple back‑ticks:
\`\`\`
${rawText.trim()}
\`\`\``;

  const chat = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: "You are an expert travel document parser." },
      { role: "user", content: prompt },
    ],
    temperature: 0.0,
  });

  const content = chat.choices[0].message.content.trim();
  return JSON.parse(content);
}
/* -------------------------------------------------------------- */

/* ---------- Express route ---------- */
app.post("/api/ocr", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    try {
      let result;
      if ([".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"].includes(ext)) {
        result = await processImage(filePath);
      } else if (ext === ".pdf") {
        result = await processPDF(filePath);
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }
      res.json(result);
    } catch (e) {
      console.error("Processing error:", e);
      res.status(500).json({ error: e.message });
    } finally {
      /* optional: delete temp file */
      fs.unlink(filePath, () => {});
    }
  });
});

app.listen(PORT, () =>
  console.log(`✅ OCR server running on http://localhost:${PORT}`)
);
