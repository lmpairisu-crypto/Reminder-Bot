# LAMPOON Reminder Bot — safer simplified build

This version keeps the bot logic in `index.js` and removes unused prompt/config/source-module files.

## Deploy on Railway

1. Keep your current Railway service stopped until you are ready to replace its files.
2. Upload these files to the connected GitHub repository or use the same source deployment method you already use:
   - `index.js`
   - `package.json`
   - `.env.example` (template only; do not add real secrets)
   - `README.md`
3. Set the environment variables in Railway under the service's Variables section. Use your existing `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`; do not put real tokens in GitHub.
4. Deploy with the start command `npm start`.

## Safety changes

- Startup no longer scans or deletes historical member messages.
- The `/cleanup` command has been removed.
- Captions on image/video messages are not sent through the text-only serious-content scanner, preventing caption false positives from deleting attached media.
- Ordinary text no longer triggers a Gemini request by default. A conservative suspicious-text prefilter sends likely-risky text to Gemini; this saves quota but can miss violations that do not match its hints.
- Repeated identical text/image results are cached briefly to reduce duplicate Gemini requests.
- Gemini quota/rate-limit errors activate a cooldown so the bot does not repeatedly hammer an exhausted free-tier quota.
- Up to three images per message are scanned to control quota use. Additional images in the same message are not AI-scanned in that pass.
- An inconclusive or unavailable image scan does not automatically delete media because of the AI result. Explicit AI rejection still follows the channel rule; normal channel-format rules still apply.
- Sticky messages have a stable hidden marker, old reminder variants are recognized, all recognized duplicates are removed before a replacement is sent, and a new sticky is not sent if deletion fails.
- The rules embed is pinned when Discord permissions allow it.
- Event Code Share channels have the rules embed plus one bottom sticky reminder.
- The HOK Strategy Forum uses channel ID `1562026949646221332`. If it is a real Discord Forum channel, the bot creates/finds a dedicated `HOK Strategy Forum — Rules & Guide` post and puts the pinned rules and sticky inside that post. Discord does not support one global bottom sticky across every separate Forum post.
- The bot only moderates new messages after startup.

## Required Discord permissions

The bot needs View Channel, Send Messages, Read Message History, Manage Messages, and Manage Threads for the forum rules post. Pinning requires the applicable permission to pin messages. `Moderate Members` is only needed if serious-violation timeouts are enabled.

## Free AI scanning

Gemini API usage depends on the provider's current free-tier eligibility and quota. If the free quota is exhausted, image classification may become inconclusive; this version keeps the media rather than treating a scanner outage as proof of a violation. Text scanning uses a suspicious-text prefilter to save requests, so it is not a guarantee that every harmful text message will be detected. It does not call an unconfigured “GPT Luna” endpoint.

## Important

Do not re-enable historical cleanup for a live server without testing it in a private test channel first. This bot has no automatic startup cleanup.
