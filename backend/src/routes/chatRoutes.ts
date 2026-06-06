import express from "express";
import { parseQuery } from "../services/ai";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // Call the AI query parser
    const parsed = await parseQuery(message);

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to process query"
    });
  }
});

export default router;
