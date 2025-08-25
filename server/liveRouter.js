import express from 'express';
import { createGeminiSession } from './geminiSession.js';

const router = express.Router();

// POST /api/live/session
// Body: { language?: string, voice?: string }
// Response: { sessionId: string, wsUrl: string }
router.post('/session', async (req, res) => {
  try {
    const { language, voice } = req.body || {};
    const session = await createGeminiSession({ language, voice });
    res.json({ sessionId: session.id, wsUrl: `/api/live/ws/${session.id}` });
  } catch (e) {
    console.error('Failed to create session:', e);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

export default router;
