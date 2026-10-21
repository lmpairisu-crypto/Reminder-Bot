# LAMPOON Reminder Bot — Render + UptimeRobot Build

All bot logic is in the root `index.js`: configuration, channel rules, pinned embeds, embed-only sticky reminders, Gemini image/text scanner prompts, validation, moderation, and slash commands. There are no `config/`, `rules/`, `pinned/`, `prompts/`, or `src/ai/` folders.

## Deploy on Render with UptimeRobot

1. Upload the project files in this ZIP to a GitHub repository. Keep `.env` and all real tokens/API keys out of GitHub.
2. In Render, create a **Web Service** from the repository and select the Free instance type.
3. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
4. In Render → Environment, set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`. Set `GEMINI_API_KEY` for AI scanning. Optional: `GEMINI_MODEL`, `MOD_LOG_CHANNEL_ID`, `LAMPOON_ICON_URL`, and `LAMPOON_FOOTER_ICON_URL`.
5. In Render's health-check path setting, use `/health`. Render supplies the `PORT` environment variable automatically; the server listens on it (or `10000` as a fallback).
6. In UptimeRobot, create an HTTP(s) monitor for `https://YOUR-RENDER-SERVICE.onrender.com/health`, using the free 5-minute interval if available. A successful response is `OK` with HTTP 200.
7. Run `npm run check` to syntax-check `index.js` before deploying.

**Free-plan uptime note:** Render Free web services can spin down after 15 minutes without inbound traffic. UptimeRobot requests may keep the service receiving traffic, but this is not a guaranteed or supported 24/7 uptime guarantee. A health endpoint only confirms that the HTTP process is responding; it does not prevent every sleep, restart, or Discord disconnection.

## Moderation behavior

- Ordinary format/off-topic mistakes are deleted immediately without a timeout; ordinary removals are console-only.
- Confirmed serious violations are deleted, logged to the moderation channel (when configured) and console, and may trigger a 60-minute timeout if the bot has `Moderate Members` permission and role hierarchy allows it.
- Replies are disabled in profile, skin, hero, fan-art, HOK meme, and Standpost meme channels. Event Code Share allows only the six status replies or listed appreciation replies when replying to a code post. The bot acknowledges status replies with “Thank you! Your response has been noted.” and appreciation replies with “You're welcome! Happy to help!” HOK Strategy Forum allows HOK-related discussion.
- The Gemini scanner uses conservative prompts, a short-lived result cache, a quota cooldown, up to three images per message, and a maximum image size of 6 MB. Scanner failures or inconclusive image results do not by themselves prove a violation.
- Only new messages are moderated; the bot does not scan or delete historical messages on startup.
- Sticky reminders are embed-only. Eligible text channels get one embed-only sticky reminder without a visible footer or divider lines. Event Code Share has separate pinned directions and a sticky reminder. HOK Strategy Forum uses a dedicated guide post only and never gets a sticky. `/sticky-cleanup` removes all recognized sticky reminders in the current channel without recreating one. Pinned directions are limited to Event Code Share and the Strategy Forum guide post.

## Environment variables

See `.env.example`. Never commit real bot tokens or API keys. Keep secrets in Railway Variables.

## Required Discord permissions

View Channels, Send Messages, Read Message History, Manage Messages, and Manage Threads where the forum guide is used. Pin Messages is needed to pin rules embeds. `Moderate Members` is required for timeouts.


### Separate embed thumbnail and footer icon
- `LAMPOON_ICON_URL` controls the embed thumbnail only. Leave it blank to omit the thumbnail.
- `LAMPOON_FOOTER_ICON_URL` controls the footer icon only and defaults to the supplied footer image URL.
- These settings are independent; the footer icon is never reused as the thumbnail.


## Latest moderation and embed fixes

- Sticky embed titles now identify the channel: PROFILE SHOWCASE, SKIN SHOWCASE, HERO HIGHLIGHTS, HOK MEMES SHARE, STANDPOST MEME SHARE, REDEMPTION CODE SHARE, and HOK FAN-ART SHARE.
- Sticky is refreshed to the bottom before spam checks, content scanning, and removal; refresh throttling and duplicate cleanup remain enabled.
- Embed footer reads `LAMPOON • Moderation 🔨`. Existing pinned embeds are edited to update the footer.
- Removal reasons explain the actual behavior and how to post correctly; the mod-log `Reason` field is separate from the original `Message` field.
- The profile image scanner prompt now rejects unrelated images and requires a clearly identifiable Honor of Kings profile/account showcase. Scanner failures or inconclusive results do not automatically delete media.
- Ordinary messageCreate events cannot receive true ephemeral replies in Discord. The bot does not DM; it uses one temporary channel warning per user/channel cooldown as the closest available substitute.
