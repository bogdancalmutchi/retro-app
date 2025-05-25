import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import fetch from "node-fetch";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Secret for OpenAI key
const openAiKey = defineSecret("OPENAI_API_KEY");

// Define allowed frontend origins
const allowedOrigins = ["http://localhost:5173", "https://sprintecho.com"];

export const generateSummary = onRequest(
  { secrets: [openAiKey] },
  async (req, res) => {
    const origin = req.headers.origin || "";

    // Set CORS headers for all responses
    if (allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
    }
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    // Handle preflight request
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      // Validate Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).send("Unauthorized: No token provided");
        return;
      }

      // Verify Firebase Auth ID token
      const idToken = authHeader.split("Bearer ")[1];
      await admin.auth().verifyIdToken(idToken);

      // Extract prompt and make OpenAI API call
      const { prompt } = req.body;
      if (!prompt) {
        res.status(400).send("Bad request: 'prompt' is required");
        return;
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      const data = await response.json();

      // Forward OpenAI response
      res.status(200).send(data);
    } catch (err) {
      logger.error("Error in generateSummary:", err);
      res.status(500).send("Internal server error");
    }
  }
);
