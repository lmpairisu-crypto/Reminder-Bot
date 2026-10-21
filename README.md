# LAMPOON Reminder Bot — Consolidated Single-File Build

All bot logic is in the root `index.js`: configuration, channel rules, pinned embeds, embed-only sticky reminders, Gemini image/text scanner prompts, validation, moderation, and slash commands. There are no `config/`, `rules/`, `pinned/`, `prompts/`, or `src/ai/` folders.

## Deploy on Railway

1. Upload the four root files in this ZIP to your repository/deployment.
2. In Railway → Variables, set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`. Set `GEMINI_API_KEY` for AI scanning. Optional: `GEMINI_MODEL`, `MOD_LOG_CHANNEL_ID`, and `LAMPOON_ICON_URL`.
3. Deploy using `npm start` (or `node index.js`).
4. Run `npm run check` to syntax-check `index.js`.

## Moderation behavior

- Ordinary format/off-topic mistakes are deleted immediately without a timeout; ordinary removals are console-only.
- Confirmed serious violations are deleted, logged to the moderation channel (when configured) and console, and may trigger a 60-minute timeout if the bot has `Moderate Members` permission and role hierarchy allows it.
- Replying is disabled in profile, skin, hero, and fan-art showcase channels. Replies are enabled in HOK meme, general meme, event-code, and HOK Strategy Forum channels. Event-code channels still validate reply text against allowed status replies.
- The Gemini scanner uses conservative prompts, a short-lived result cache, a quota cooldown, up to three images per message, and a maximum image size of 6 MB. Scanner failures or inconclusive image results do not by themselves prove a violation.
- Only new messages are moderated; the bot does not scan or delete historical messages on startup.
- Sticky reminders are embed-only. The bot keeps one recognized sticky and attempts to pin the rules embed where Discord permissions allow. Forum channels cannot have a single global sticky across all posts; the bot uses a dedicated guide post.

## Environment variables

See `.env.example`. Never commit real bot tokens or API keys. Keep secrets in Railway Variables.

## Required Discord permissions

View Channels, Send Messages, Read Message History, Manage Messages, and Manage Threads where the forum guide is used. Pin Messages is needed to pin rules embeds. `Moderate Members` is required for timeouts.
