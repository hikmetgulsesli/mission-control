import { Router } from 'express';
import { sendDiscord } from '../utils/discord.js';
const router = Router();
const TELEGRAM_BOT_TOKEN = '8278662543:AAF6iwgIo4Rp1R0OGa-gMJRm7aXv29qeQFY';
const TELEGRAM_CHAT_ID = '725838988';
const DISCORD_CH_ALERTS = process.env.DISCORD_CH_ALERTS || '';
async function sendTelegram(message) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
            }),
        });
        const data = await res.json();
        return data.ok === true;
    }
    catch {
        return false;
    }
}
// POST /api/notify - Send a notification
router.post('/notify', async (req, res) => {
    const { message, level = 'info' } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'message required' });
    }
    const prefix = level === 'critical' ? '🔴 CRITICAL'
        : level === 'warning' ? '🟡 WARNING'
            : 'ℹ️ INFO';
    const text = `${prefix} — Mission Control\n\n${message}`;
    const [tgOk, dcOk] = await Promise.all([
        sendTelegram(text),
        sendDiscord(DISCORD_CH_ALERTS, text),
    ]);
    res.json({ ok: tgOk || dcOk, telegram: tgOk, discord: dcOk });
});
// POST /api/health-report - Receive health check results and alert on issues
router.post('/health-report', async (req, res) => {
    const { checks = [] } = req.body;
    const failed = checks.filter((c) => !c.ok);
    if (failed.length === 0) {
        return res.json({ ok: true, alerts: 0 });
    }
    const lines = failed.map((c) => `• *${c.name}*: ${c.error || 'down'}`);
    const text = `🔴 *Health Check Alert*\n\n${failed.length} issue(s) detected:\n${lines.join('\n')}`;
    const [tgOk, dcOk] = await Promise.all([
        sendTelegram(text),
        sendDiscord(DISCORD_CH_ALERTS, text),
    ]);
    res.json({ ok: tgOk || dcOk, alerts: failed.length, telegram: tgOk, discord: dcOk });
});
export default router;
export { sendTelegram };
