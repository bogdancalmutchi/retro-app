import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import fetch from "node-fetch";
import { defineSecret } from "firebase-functions/params";

import { authAdmin } from "./firebaseAdmin";
import { allowedOrigins } from "./config";

export { setTempPassword, signup, syncUserClaims } from "./auth";

// Secret for OpenAI key
const openAiKey = defineSecret("OPENAI_API_KEY");

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
      // Verified separately from the work below so that a bad or expired token
      // answers 401 rather than falling through to the catch-all 500, which
      // would tell the user "server error" when they simply need to sign in.
      const idToken = authHeader.split("Bearer ")[1];
      let token;
      try {
        token = await authAdmin.verifyIdToken(idToken);
      } catch {
        res.status(401).send("Unauthorized: invalid or expired token");
        return;
      }

      // The button is already hidden for non-admins, but that is only cosmetic:
      // any signed-in user could POST here with their own ID token, and every
      // call spends money at OpenAI. The claim is the actual gate.
      if (token.isAdmin !== true) {
        logger.warn("Rejected non-admin summary request", { uid: token.uid });
        res.status(403).send("Forbidden: admins only");
        return;
      }

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
