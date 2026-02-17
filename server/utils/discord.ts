import { runCli } from './cli.js';

/**
 * Send a message to a Discord channel via openclaw CLI.
 */
export async function sendDiscord(channelId: string, message: string): Promise<boolean> {
  if (!channelId) {
    console.error('[discord] No channel ID provided');
    return false;
  }
  try {
    await runCli('openclaw', [
      'message', 'send',
      '--channel', 'discord',
      '--target', channelId,
      '--message', message,
    ]);
    return true;
  } catch (err: any) {
    console.error(`[discord] Send failed: ${err.message}`);
    return false;
  }
}
