# 📁 HOK Community Bot — Complete File Index
## Last Updated: 2026-10-20

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📂 ROOT FOLDER
    INDEX.md               ← This file — master index
    package.json          ← Project & dependency info
    .env.example          ← API key template — rename to .env
    README.md             ← Setup & installation guide

## 📂 config/ — Bot Configuration
    channels.json         → All channel IDs, names, and types
    allowed-replies.json  → Code Share: ONLY 6 replies allowed
    ai-rules.json         → AI scanner moderation & safety rules

## 📂 prompts/ — AI Scanner Instructions
    profile-showcase.txt  → Valid profile content definition
    skin-showcase.txt     → Skin showcase content definition
    hero-highlight.txt    → VIDEOS ONLY — reject all images
    hok-meme.txt          → HOK-related memes only — block NSFW
    standpost-meme.txt    → General memes — block NSFW
    code-share.txt        → Codes + screenshots + instructions only
    fan-art.txt           → AI art, pixel, drawings, stickers, HOK wallpapers
    strategy-forum.txt    → Strategy content only — no chat

## 📂 pinned/ — Channel Pinned Messages
    event-code-share.md   → 📌 Code Share pinned rules
    strategy-forum.md    → 📌 Strategy Forum pinned rules

## 📂 src/ — Source Code
    bot.js                → ✅ MAIN ENTRY POINT — Run this file
    message-handler.js    → Routes messages & enforces rules per channel

## 📂 src/ai/ — 🆕 Gemini AI Scanner Module
    gemini-scanner.js     → Gemini 2.5 Flash — analyze images & text
    content-classifier.js → Classify content against channel rules
    moderation-actions.js → Auto-delete violations + log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 FINAL CHANNEL RULES SUMMARY

| Channel Name | Allowed Content | Replies Allowed |
|---|---|---|
| 📸 Profile Showcase ×2 | Profiles, Match History, Gallery, Titles, Nobility, Badges | ❌ No chat |
| 🎨 Skin Showcase ×2 | Skins, Wardrobe, Gifts, Shop, Consignment, Personalization | ❌ No chat |
| 🎬 Hero Highlight | **VIDEOS ONLY** — gameplay & highlights | ❌ No chat — images removed |
| 😂 HOK Meme Share | HOK-related memes only | ❌ No chat — NSFW removed |
| 😂 Standpost Meme | General internet memes | ❌ No chat — NSFW removed |
| 🖌️ Fan Art | AI art, pixel, drawings, stickers, HOK wallpapers | ❌ No chat |
| 📖 HOK Strategy Forum | Match History, Stats, Tiers, Arcana, Builds, Strategy Guides | ❌ No chat |
| 🎁 Event Code Share | Codes + screenshots + instructions | ✅ done / used / invalid / expired / not work / error |

> 🚫 GLOBAL RULE: Sexualized / NSFW content → removed from both meme channels immediately
