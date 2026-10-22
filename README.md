# LAMPOON Reminder Bot — Render Deployment

All bot logic is in the root `index.js`: channel rules, pinned embeds, sticky reminders, Gemini image/text scanning, validation, moderation logs, and slash commands.

## Deploy on Render

1. Push the project files to your GitHub repository. Keep `.env` and all real tokens/API keys out of GitHub.
2. In Render, create a **Web Service** connected to this repository and the `main` branch.
3. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
4. In Render → **Environment**, add the variables listed below. Use the exact names; environment-variable names are case-sensitive.
5. Set the health-check path to `/health` if the setting is available. Render supplies `PORT` automatically.
6. After deployment, check the Render Events page for the deployed commit and compare it with the latest commit on GitHub `main`.
7. Run `npm run check` locally or in the build environment to check the JavaScript syntax.

### Optional UptimeRobot monitor

Monitor `https://YOUR-RENDER-SERVICE.onrender.com/health`. A successful health check means the HTTP endpoint responds; it does not prove that the Discord bot is connected or that the latest code is deployed. Render Free services may spin down after inactivity, and external pings are not a guaranteed 24/7 uptime solution.

## Environment variables

Required:
- `DISCORD_TOKEN` — Discord bot token.
- `CLIENT_ID` — Discord application ID.
- `GUILD_ID` — Discord server ID.

Optional:
- `GEMINI_API_KEY` — enables AI image/text scanning.
- `GEMINI_MODEL` — Gemini model name; defaults to the value set in `index.js`.
- `MOD_LOG_CHANNEL_ID` — private staff moderation-log channel ID.
- `REMINDER_LOG_CHANNEL_ID` — member-facing moderation explanation channel ID. This must be a different channel from `MOD_LOG_CHANNEL_ID`.
- `LAMPOON_ICON_URL` — embed thumbnail URL; leave blank to omit it.
- `LAMPOON_FOOTER_ICON_URL` — footer icon URL, independent from the thumbnail.

Keep all real tokens and API keys in **Render → Environment**, not in GitHub. Do not use Railway variable settings for a service hosted on Render.

## Moderation behavior

- **No direct messages:** The code in this repository does not call `user.send()`, `message.author.send()`, or `createDM()` to send moderation messages.
- **No ephemeral moderation warnings:** Ordinary message-create events cannot receive true ephemeral replies. The bot deletes disallowed content and writes explanations to the configured moderation-log channels instead of sending a warning DM or a temporary warning message in the channel.
- **Two separate logs:** `MOD_LOG_CHANNEL_ID` is intended for staff; `REMINDER_LOG_CHANNEL_ID` is intended for member-facing explanations. Configure both if you want both logs. The bot may mention the member in the log channel, but a channel mention is not a DM.
- **Ordinary content corrections:** Disallowed ordinary/off-topic content is deleted without a timeout; removal details are logged to the configured channels.
- **Serious violations:** The message is deleted and logged. A 60-minute timeout may be applied if the bot has the required permission and role hierarchy permits it.
- **Spam:** Five messages within ten seconds is treated as a serious spam burst. The spam timeout is one minute, except in Code Share and Strategy Forum channels, where the spam timeout is skipped.
- **Code Share acknowledgements:** When replying to a code post, approved appreciation replies may receive “You're welcome! Happy to help!” and approved status replies may receive “Thank you! Your response has been noted!” These are public replies in the server channel, not DMs.
- **AI scanner:** Scanner failures or inconclusive image results do not, by themselves, prove a violation. The scanner uses caching and quota cooldown protections and supports up to three images per message.
- **Historical messages:** The bot moderates new messages only; it does not scan or delete historical messages on startup.
- **Sticky reminders:** Sticky reminders are embed-only. The bot refreshes the sticky in eligible channels and cleans up recognized duplicates. HOK Strategy Forum uses a dedicated guide post and does not get a sticky. `/sticky-cleanup` removes recognized sticky reminders in the current channel without recreating one.

## Required Discord permissions

Grant only the permissions the bot needs:
- View Channels
- Send Messages
- Read Message History
- Manage Messages
- Manage Threads where the forum guide is used
- Pin Messages if the bot must pin rules embeds
- Moderate Members if timeouts should be applied

## Embed icon settings

- `LAMPOON_ICON_URL` controls the embed thumbnail only.
- `LAMPOON_FOOTER_ICON_URL` controls the footer icon only.
- The thumbnail and footer icon settings are independent.
