import express from "express";
import { parseUserQuery } from "../services/kimiService";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // CALL THE SERVICE HERE
    const result = await parseUserQuery(message);

    const parsed = JSON.parse(result || "{}");

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to process query"
    });
  }
});

export default router;