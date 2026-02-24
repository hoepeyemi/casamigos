/**
 * POST /api/cre-events - Append CRE workflow event payloads to a file.
 * Called by the CRE workflow when it receives contract events (EVM log trigger).
 * Events are stored in data/cre-events.jsonl (one JSON object per line).
 */

import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'cre-events.jsonl');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

interface CREEventPayload {
  eventName: string;
  contractAddress?: string;
  blockNumber?: string | number;
  txHash?: string;
  logIndex?: number;
  args?: Record<string, unknown>;
  receivedAt: string;
}

router.post('/', (req, res) => {
  try {
    const payload: CREEventPayload = {
      ...req.body,
      receivedAt: new Date().toISOString(),
    };
    if (!payload.eventName) {
      return res.status(400).json({ error: 'eventName is required' });
    }
    ensureDataDir();
    const line = JSON.stringify(payload) + '\n';
    fs.appendFileSync(EVENTS_FILE, line);
    console.log(`[cre-events] Appended ${payload.eventName} to ${EVENTS_FILE}`);
    return res.status(200).json({ ok: true, eventName: payload.eventName });
  } catch (err) {
    console.error('[cre-events] Error appending event:', err);
    return res.status(500).json({ error: 'Failed to store event' });
  }
});

// GET /api/cre-events - Read stored events (optional, for debugging)
router.get('/', (_req, res) => {
  try {
    ensureDataDir();
    if (!fs.existsSync(EVENTS_FILE)) {
      return res.json({ events: [], file: EVENTS_FILE });
    }
    const content = fs.readFileSync(EVENTS_FILE, 'utf-8');
    const events = content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CREEventPayload);
    return res.json({ events, file: EVENTS_FILE });
  } catch (err) {
    console.error('[cre-events] Error reading events:', err);
    return res.status(500).json({ error: 'Failed to read events' });
  }
});

export default router;
