
require("dotenv").config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

// ============================================================
// ENVIRONMENT
// ============================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const MOD_LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || null;
const LAMPOON_ICON_URL = process.env.LAMPOON_ICON_URL || null;

// ========= YOUR THRESHOLDS HERE =========
const MODERATION_TIMEOUT_MINUTES = 0;      // moderate = 0
const REPEATED_VIOLATION_TIMEOUT_MINUTES = 0; // repeated = 0
const SERIOUS_VIOLATION_TIMEOUT_MINUTES = 60; // serious = 60

const STARTUP_CLEANUP_LIMIT = Number(process.env.STARTUP_CLEANUP_LIMIT) || 100;
const STARTUP_DEEP_CLEANUP = String(process.env.STARTUP_DEEP_CLEANUP || "false").toLowerCase() === "true";

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN.");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID.");
if (!GUILD_ID) throw new Error("Missing GUILD_ID.");

if (!GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY is not configured. Image AI moderation will be unavailable.");
}

// ============================================================
// HELPERS
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// GEMINI AI
// ============================================================

const genAI = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : null;

// ============================================================
// DISCORD CLIENT
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
  ],
});

// ============================================================
// CONSTANTS
// ============================================================

const GOLD = "#D4AF37";
const PINNED_MARKER = "📌 READ CHANNEL'S TOPIC !";
const AVISALA = "<a:Avisala:1542448826265243660>";

// ============================================================
// CHANNEL RULES
// ============================================================

const CHANNEL_RULES = {
  "1544771901308796929": {
    type: "profile",
    name: "Community Profile Showcase",
    description: "Share your Honor of Kings profile and profile showcase.",
    allowReplies: false,
    allowChat: false,
  },
  "1544183278779764742": {
    type: "profile",
    name: "Lampoon Profile Showcase",
    description: "Share your Honor of Kings profile and profile showcase.",
    allowReplies: false,
    allowChat: false,
  },
  "1544771836175196204": {
    type: "skin",
    name: "Community Skin Showcase",
    description: "Share Honor of Kings skins, skin previews, collections, reveals, or skin-related screenshots.",
    allowReplies: false,
    allowChat: false,
  },
  "1544183056867393599": {
    type: "skin",
    name: "Lampoon Skin Showcase",
    description: "Share Honor of Kings skins, skin previews, collections, reveals, or skin-related screenshots.",
    allowReplies: false,
    allowChat: false,
  },
  "1544771692025483315": {
    type: "hero",
    name: "Community Hero Highlight",
    description: "Share Honor of Kings Hero Highlight videos.",
    allowReplies: false,
    allowChat: false,
  },
  "1544181729097687120": {
    type: "hero",
    name: "Lampoon Hero Highlight",
    description: "Share Honor of Kings Hero Highlight videos.",
    allowReplies: false,
    allowChat: false,
  },
  "1541020560929198090": {
    type: "hok-meme",
    name: "Community HOK Meme Share",
    description: "Share Honor of Kings memes, funny screenshots, edits, reactions, and parody content.",
    allowReplies: false,
    allowChat: false,
  },
  "1543552879942434837": {
    type: "general-meme",
    name: "Lampoon Standpost Meme",
    description: "Share general memes, funny images, reactions, edits, entertainment, and Honor of Kings memes.",
    allowReplies: false,
    allowChat: false,
  },
  "1541019893552644187": {
    type: "code",
    name: "Community Event Code Share",
    description: "Share Honor of Kings event codes, redemption screenshots, and instructions.",
    allowReplies: true,
    allowChat: false,
  },
  "1544182436353810432": {
    type: "code",
    name: "Lampoon Event Share Code",
    description: "Share Honor of Kings event codes, redemption screenshots, and instructions.",
    allowReplies: true,
    allowChat: false,
  },
  "1541020395426283521": {
    type: "fanart",
    name: "Community HOK Fan Art Share",
    description: "Share Honor of Kings fan art, drawings, illustrations, edits, and artwork.",
    allowReplies: false,
    allowChat: false,
  },
  "1562026949646221332": {
    type: "build",
    name: "HOK Strategy Forum",
    description: "Match History • Stats • Hero/Lane Tiers • Arcana • Builds • Map Awareness • Economy • In-game Strategy",
    allowReplies: true,
    allowChat: true,
  },
};

// ============================================================
// PINNED MESSAGES (shown at top)
// ============================================================

const PINNED_TITLES = {
  profile: `${AVISALA} PROFILE SHOWCASE`,
  skin: `${AVISALA} SKIN SHOWCASE`,
  hero: `${AVISALA} HERO HIGHLIGHT`,
  "hok-meme": `${AVISALA} HOK MEME SHARE`,
  "general-meme": `${AVISALA} LAMPOON STANDPOST MEME`,
  code: `${AVISALA} EVENT CODE SHARE`,
  fanart: `${AVISALA} FAN ART`,
  build: `${AVISALA} HOK STRATEGY FORUM`,
};

// ============================================================
// STICKY MESSAGES (shown at bottom — TEXT CHANNELS ONLY)
// ============================================================

const STICKY_MESSAGES = {
  profile: `💡 Post your profile showcase below! Don't reply to others' posts — thanks! 😊`,
  skin: `💡 Show off your skins! Keep it clean and enjoy — happy sharing! ✨`,
  hero: `💡 Share your best plays and highlights below — we wanna see them! 🎬`,
  "hok-meme": `💡 Keep it funny, keep it HOK — have fun! 🤣`,
  "general-meme": `💡 Meme away — make someone smile today! No HOK required 😄`,
  code: `💡 Please reply ONLY with: done / used / invalid / expired / not work / error — thank you! 🙏`,
  fanart: `💡 Share your amazing art — credit artists where possible! 🎨`,
  build: `💡 Chat freely about Honor of Kings — English or Tagalog welcome! 🗣️`,
};

// ============================================================
// RUNTIME MEMORY
// ============================================================

const pinnedMessages = new Map();
const stickyMessages = new Map();
const violationCounts = new Map();
const stickyLocks = new Map();
const startupCleanupDone = new Set();

// ============================================================
// MEDIA HELPERS
// ============================================================

function isImage(attachment) {
  if (!attachment) return false;
  const contentType = attachment.contentType || "";
  const name = attachment.name || "";
  return contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(name);
}

function isVideo(attachment) {
  if (!attachment) return false;
  const contentType = attachment.contentType || "";
  const name = attachment.name || "";
  return contentType.startsWith("video/") ||
    /\.(mp4|mov|webm|mkv|avi)$/i.test(name);
}

function getImages(message) {
  return [...message.attachments.values()].filter(isImage);
}

function getVideos(message) {
  return [...message.attachments.values()].filter(isVideo);
}

// ============================================================
// EVENT CODE DETECTION
// ============================================================

function containsPossibleCode(text) {
  if (!text) return false;
  const value = text.trim();
  return /\b[A-Z0-9]{4,32}\b/i.test(value) ||
         /\b[A-Z0-9]{2,16}[-_][A-Z0-9]{2,16}\b/i.test(value) ||
         /\b\d{4,32}\b/.test(value);
}

// ============================================================
// ALLOWED REPLIES — CODE CHANNEL
// ============================================================

const ALLOWED_CODE_REPLIES = ["done", "used", "invalid", "expired", "not work", "error"];

function isAllowedCodeReply(text) {
  const clean = text.trim().toLowerCase();
  return ALLOWED_CODE_REPLIES.some(reply => clean === reply || clean.includes(reply));
}

// ============================================================
// STRATEGY FORUM — KEYWORDS (English + Tagalog)
// ============================================================

const QUICK_POSITIVE_WORDS = [
  "thank", "thanks", "ty", "good", "great", "nice", "helpful",
  "useful", "awesome", "excellent", "perfect", "done", "got it",
  "understood", "cool", "wow", "amazing", "agree", "makes sense",
  "glad", "hope", "good luck", "gl hf", "have fun", "good game", "gg",
  "salamat", "salamat po", "salamat din", "maraming salamat",
  "ganda", "ang ganda", "maganda", "galing", "ang galing", "ang galing mo",
  "ayos", "ayos lang", "ayos yan", "okay", "sige", "sige po",
  "tulong", "salamat sa tulong", "paano", "bakit", "saan",
  "opo", "oo", "hindi", "syempre", "tama", "mali",
  "ingat", "good luck", "kaya mo yan", "laban lang", "panalo tayo",
  "malas", "galingan mo", "kaya natin", "pahinga", "laro tayo",
  "babye", "kita kits", "see you", "ingat kayo"
];

const HOK_RELATED_KEYWORDS = [
  "build", "arcana", "item", "items", "equipment", "spell", "emblem",
  "hero", "lane", "tier", "guide", "tip", "how", "what", "why", "where",
  "match", "game", "win", "lose", "strategy", "counter", "best", "better",
  "run", "play", "team", "map", "wave", "farm", "gold", "exp", "level",
  "damage", "defense", "sustain", "combo", "skill", "talent", "buff", "nerf",
  "recommend", "suggest", "should", "trying", "works", "opinion", "think",
  "stat", "stats", "history", "score", "kda", "difficult", "easy", "beginner",
  "mid", "jungle", "exp lane", "gold lane", "roam", "support", "tank",
  "mage", "assassin", "marksman", "warrior", "draft", "pick", "ban",
  "rotation", "objective", "dragon", "titan", "turret", "push", "split",
  "gank", "focus", "target", "position", "range", "cooldown", "energy",
  "mana", "health", "heal", "shield", "speed", "slow", "stun", "cc",
  "crowd control", "burst", "dps", "poke", "engage", "disengage", "kite",
  "honor of kings", "hok", "patch", "update", "meta", "rank",
  "ranking", "season", "battle", "fight", "enemy", "ally", "teammate",
  "question", "answer", "help", "learn", "practice", "mode", "arena",
  "ranking match", "star", "rank up", "climb", "win rate", "matchmaking",
  "laro", "maglaro", "naglaro", "lalaro", "laban", "panalo", "talo",
  "nanalo", "natalo", "kalaban", "kakampi", "tropa", "ka-team",
  "hero ko", "gamit", "gamitin", "subukan", "try", "tulong po",
  "paano gamitin", "ano ba", "may alam ba", "tanong lang po",
  "suggestion", "opinyon", "ano sa tingin niyo", "maganda ba",
  "mas okay ba", "mas maganda ba", "mas malakas ba", "try ko yan",
  "gumana", "hindi gumana", "gusto ko malaman", "panoorin niyo",
  "tignan niyo", "mas maganda", "mas malakas", "mabilis", "matigas",
  "pagkatalo", "panalo tayo", "laban lang", "kaya natin", "galingan natin",
  "ranked", "ranked match", "pataas ng rank", "star points", "season pass"
];

function isHokRelatedConversation(text) {
  const lower = text.toLowerCase();
  return QUICK_POSITIVE_WORDS.some(word => lower.includes(word)) ||
         HOK_RELATED_KEYWORDS.some(word => lower.includes(word));
}

// ============================================================
// CREATE PINNED EMBED
// ============================================================

function createPinnedEmbed(rule) {
  const displayName = PINNED_TITLES[rule.type] || `${AVISALA} ${rule.name}`;

  let replyNote = "🚫 **Do not reply to another member's post.**";
  let extraNote = "";

  if (rule.type === "code") {
    replyNote = "✅ You may ONLY reply with these:\n• ✅ **done** — successfully claimed\n• ⚠️ **used** — already claimed by someone\n• ❌ **invalid** — code not recognized\n• ⏰ **expired** — code no longer active\n• 🔧 **not work** — couldn't redeem\n• 🐛 **error** — something went wrong";
    extraNote = "\n❌ All other replies or chat will be removed.";
  } else if (rule.type === "build") {
    replyNote = "💡 Casual chatting is welcome — as long as it's related to Honor of Kings! English or Tagalog is fine.";
    extraNote = "\n❌ Real life talk or completely off-topic posts will be removed.";
  }

  const channelNote = rule.type === "general-meme"
    ? "✅ **General memes are allowed. Honor of Kings is NOT required.**"
    : "🚫 **Unrelated content will be removed.**";

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(PINNED_MARKER)
    .setThumbnail(LAMPOON_ICON_URL || client.user?.displayAvatarURL() || null)
    .setDescription(
      `**${displayName}**\n\n` +
      `${rule.description}\n\n` +
      `${replyNote}\n` +
      `${extraNote}\n\n` +
      `${channelNote}`
    );
}

// ============================================================
// DETECT MESSAGES
// ============================================================

function isPinnedMessage(message) {
  return message?.author?.id === client.user?.id &&
    message.embeds?.some(embed => embed.title === PINNED_MARKER);
}

function isStickyBotMessage(message) {
  return message?.author?.id === client.user?.id &&
    !message.embeds?.length &&
    STICKY_MESSAGES[Object.keys(STICKY_MESSAGES).find(k => STICKY_MESSAGES[k] === message.content)];
}

// ============================================================
// FIND EXISTING MESSAGES
// ============================================================

async function findExistingPinned(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    return [...messages.values()].filter(isPinnedMessage);
  } catch (error) {
    console.error(`❌ Pinned search failed in #${channel.name}:`, error.message);
    return [];
  }
}

async function findExistingSticky(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    return [...messages.values()].find(isStickyBotMessage);
  } catch (error) {
    console.error(`❌ Sticky search failed in #${channel.name}:`, error.message);
    return null;
  }
}

// ============================================================
// ENSURE PINNED MESSAGE
// ============================================================

async function ensurePinned(channel, rule) {
  if (!channel?.isTextBased()) return null;
  const embed = createPinnedEmbed(rule);
  
  const existing = await findExistingPinned(channel);
  
  // Keep only one pinned message
  for (let i = 1; i < existing.length; i++) {
    await existing[i].delete().catch(() => {});
  }
  
  if (existing.length > 0) {
    if (existing[0].embeds[0]?.description !== embed.data.description) {
      await existing[0].edit({ embeds: [embed] });
      console.log(`📝 Updated pinned in #${channel.name}`);
    }
    return existing[0];
  } else {
    const msg = await channel.send({ embeds: [embed] });
    console.log(`📌 Pinned added to #${channel.name}`);
    return msg;
  }
}

// ============================================================
// ENSURE STICKY MESSAGE — TEXT CHANNELS ONLY
// ============================================================

async function ensureSticky(channel, rule) {
  if (!channel?.isTextBased()) return null;
  
  // ✅ FORUM CHANNELS = NO STICKY AT ALL
  if (channel.type === ChannelType.GuildForum) {
    console.log(`📋 #${channel.name} is Forum Channel → Sticky skipped`);
    return null;
  }
  
  if (stickyLocks.get(channel.id)) return stickyMessages.get(channel.id) || null;
  stickyLocks.set(channel.id, true);
  
  try {
    // Remove old sticky
    const oldSticky = await findExistingSticky(channel);
    if (oldSticky) {
      await oldSticky.delete().catch(() => {});
    }
    
    // Send new sticky at bottom
    const stickyText = STICKY_MESSAGES[rule.type] || STICKY_MESSAGES.profile;
    const newSticky = await channel.send(stickyText);
    stickyMessages.set(channel.id, newSticky);
    console.log(`💡 Sticky refreshed in #${channel.name}`);
    return newSticky;
  } catch (error) {
    console.error(`❌ Sticky failed in #${channel.name}:`, error.message);
    return null;
  } finally {
    stickyLocks.delete(channel.id);
  }
}

// ============================================================
// GEMINI IMAGE CLASSIFICATION
// ============================================================

async function askGeminiImage(imageUrl, channelType) {
  if (!genAI) {
    return { status: "unknown", serious: false, reason: "Gemini AI moderation is not configured." };
  }

  const instructions = {
    profile: `Check if image shows Honor of Kings profile/account info. Return JSON only: {"status":"allowed"|"rejected"|"unknown","serious":false,"reason":"explanation"}`,
    skin: `Check if image shows HOK skins/previews. Return JSON only: {"status":"allowed"|"rejected"|"unknown","serious":false,"reason":"explanation"}`,
    "hok-meme": `Check if image is HOK-related meme. Return JSON only: {"status":"allowed"|"rejected"|"unknown","serious":false,"reason":"explanation"}`,
    "general-meme": `Accept any meme/funny image. Only flag serious prohibited content. Return JSON only: {"status":"allowed"|"rejected"|"unknown","serious":true|false,"reason":"explanation"}`,
    fanart: `Check if image is HOK-related artwork. Return JSON only: {"status":"allowed"|"rejected"|"unknown","serious":false,"reason":"explanation"}`,
  };

  const instruction = instructions[channelType] || instructions["general-meme"];

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const imageResp = await fetch(imageUrl).then(r => r.arrayBuffer());
    const base64Image = Buffer.from(imageResp).toString('base64');

    const result = await model.generateContent([
      instruction,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png",
        },
      },
    ]);

    const output = result.response.text();
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return { status: "unknown", serious: false, reason: "Unreadable response." };

    const parsed = JSON.parse(match[0]);
    const status = ["allowed", "rejected", "unknown"].includes(parsed.status) ? parsed.status : "unknown";
    return { status, serious: Boolean(parsed.serious), reason: String(parsed.reason || "").slice(0, 500) };
  } catch (error) {
    console.error("❌ Gemini image check failed:", error.message);
    return { status: "unknown", serious: false, reason: "Check temporarily unavailable." };
  }
}

// ============================================================
// TEXT SERIOUS-CONTENT CHECK — GEMINI
// ============================================================

async function checkTextForSeriousViolation(message) {
  const text = message.content?.trim() || "";
  if (!text || !genAI || text.length < 8) return { serious: false, reason: "" };

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(
      `Review for serious violations only — bad words, sexual content, scams, links, harassment. Message: """${text}""" Return JSON only: {"serious":true|false,"reason":"short reason"}`
    );

    const output = result.response.text();
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return { serious: false, reason: "" };
    const parsed = JSON.parse(match[0]);
    return { serious: Boolean(parsed.serious), reason: String(parsed.reason || "").slice(0, 500) };
  } catch (error) {
    console.error("❌ Text check failed:", error.message);
    return { serious: false, reason: "" };
  }
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

function validateEventCode(message) {
  const images = getImages(message);
  if (containsPossibleCode(message.content)) return { allowed: true, serious: false, reason: "Code detected." };
  if (images.length) return { allowed: true, serious: false, reason: "Code screenshot accepted." };
  return { allowed: false, serious: false, reason: "No code found." };
}

function validateBuildPost(message) {
  const images = getImages(message);
  const videos = getVideos(message);
  if (images.length || videos.length) return { allowed: true, serious: false, reason: "Media accepted." };
  const text = message.content.trim();
  if (text.length < 15) return { allowed: false, serious: false, reason: "Post too short." };
  if (isHokRelatedConversation(text)) {
    return { allowed: true, serious: false, reason: "On-topic conversation allowed." };
  }
  return { allowed: false, serious: false, reason: "Please keep discussion related to Honor of Kings. Thank you!" };
}

// ============================================================
// MESSAGE VALIDATION
// ============================================================

async function validateMessage(message, rule) {
  const images = getImages(message);
  const videos = getVideos(message);

  const seriousText = await checkTextForSeriousViolation(message);
  if (seriousText.serious) return { allowed: false, serious: true, reason: seriousText.reason };

  // Block replies where not allowed
  if (message.reference && !rule.allowReplies) {
    return { allowed: false, serious: false, reason: "Replies are not allowed in this channel." };
  }

  const hasMedia = images.length > 0 || videos.length > 0;
  const hasCode = containsPossibleCode(message.content);
  const isOnlyText = !hasMedia && !hasCode && message.content.trim().length > 0;

  // 🎁 CODE CHANNEL — Only 6 specific replies allowed
  if (isOnlyText && rule.type === "code") {
    if (isAllowedCodeReply(message.content)) {
      return { allowed: true, serious: false, reason: "Allowed reply." };
    }
    return { allowed: false, serious: false, reason: "Only these replies allowed: done, used, invalid, expired, not work, error." };
  }

  // 📖 STRATEGY FORUM — HOK/game-related chat ALLOWED
  if (isOnlyText && rule.type === "build") {
    if (isHokRelatedConversation(message.content)) {
      return { allowed: true, serious: false, reason: "HOK-related conversation allowed." };
    }
    return { allowed: false, serious: false, reason: "Please keep discussion related to Honor of Kings." };
  }

  if (rule.type === "general-meme") {
    if (images.length || videos.length) {
      if (images.length) {
        const r = await askGeminiImage(images[0].url, "general-meme");
        if (r.serious) return { allowed: false, serious: true, reason: r.reason };
      }
      return { allowed: true, serious: false, reason: "Accepted." };
    }
    if (message.content.trim()) return { allowed: true, serious: false, reason: "Text accepted." };
    return { allowed: false, serious: false, reason: "Empty message." };
  }

  if (rule.type === "profile") {
    if (!images.length && !videos.length) return { allowed: false, serious: false, reason: "Profile image/video required." };
    if (images.length) {
      const r = await askGeminiImage(images[0].url, "profile");
      if (r.serious) return { allowed: false, serious: true, reason: r.reason };
      if (r.status === "allowed") return { allowed: true, serious: false, reason: r.reason };
      return { allowed: false, serious: false, reason: r.reason || "Not a profile showcase." };
    }
    return { allowed: true, serious: false, reason: "Video accepted." };
  }

  if (rule.type === "skin") {
    if (!images.length && !videos.length) return { allowed: false, serious: false, reason: "Skin image/video required." };
    if (images.length) {
      const r = await askGeminiImage(images[0].url, "skin");
      if (r.serious) return { allowed: false, serious: true, reason: r.reason };
      if (r.status === "allowed") return { allowed: true, serious: false, reason: r.reason };
      return { allowed: false, serious: false, reason: r.reason || "Not a skin showcase." };
    }
    return { allowed: true, serious: false, reason: "Video accepted." };
  }

  if (rule.type === "hero") {
    if (!videos.length) return { allowed: false, serious: false, reason: "Hero highlight video required." };
    return { allowed: true, serious: false, reason: "Accepted." };
  }

  if (rule.type === "hok-meme") {
    if (!images.length && !videos.length) return { allowed: false, serious: false, reason: "Meme image/video required." };
    if (images.length) {
      const r = await askGeminiImage(images[0].url, "hok-meme");
      if (r.serious) return { allowed: false, serious: true, reason: r.reason };
      if (r.status === "allowed") return { allowed: true, serious: false, reason: r.reason };
      return { allowed: false, serious: false, reason: r.reason || "Not a HOK meme." };
    }
    return { allowed: true, serious: false, reason: "Video accepted." };
  }

  if (rule.type === "code") return validateEventCode(message);

  if (rule.type === "fanart") {
    if (!images.length) return { allowed: false, serious: false, reason: "Fan art image required." };
    const r = await askGeminiImage(images[0].url, "fanart");
    if (r.serious) return { allowed: false, serious: true, reason: r.reason };
    if (r.status === "allowed") return { allowed: true, serious: false, reason: r.reason };
    return { allowed: false, serious: false, reason: r.reason || "Not HOK fan art." };
  }

  if (rule.type === "build") return validateBuildPost(message);

  return { allowed: true, serious: false, reason: "Allowed." };
}

// ============================================================
// MODERATION — SIMPLIFIED: ONLY SERIOUS = ACTION
// ============================================================

async function sendModerationLog(embed) {
  if (!MOD_LOG_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(MOD_LOG_CHANNEL_ID);
    if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
  } catch (e) { console.error("❌ Log failed:", e.message); }
}

async function timeoutMember(member, minutes, reason) {
  try {
    if (!member || member.user.bot) return false;
    const me = member.guild.members.me;
    if (!me || !me.permissions.has(PermissionFlagsBits.ModerateMembers)) return false;
    if (member.roles.highest.position >= me.roles.highest.position) return false;
    if (minutes <= 0) return false; // Skip if timeout = 0
    await member.timeout(Math.max(1, minutes) * 60 * 1000, reason);
    await sendModerationLog(
      new EmbedBuilder().setColor("#FF9900").setTitle("⏱️ MEMBER TIMEOUT")
        .setDescription(`**Member:** ${member}\n**Duration:** ${minutes} min\n**Reason:** ${reason}`).setTimestamp()
    );
    return true;
  } catch (e) { console.error("❌ Timeout failed:", e.message); return false; }
}

async function registerViolation(message, reason, serious = false) {
  if (!message.guild) return;
  
  // Only count/action for SERIOUS violations
  if (!serious) {
    await sendModerationLog(
      new EmbedBuilder().setColor("#888888").setTitle("🗑️ CONTENT REMOVED")
        .setDescription(`**Member:** ${message.author}\n**Channel:** ${message.channel}\n**Reason:** ${reason}\n**Note:** Non-serious — deleted only`).setTimestamp()
    );
    return; // ❌ No violation points for casual stuff
  }

  const key = `${message.guild.id}:${message.author.id}`;
  const count = (violationCounts.get(key) || 0) + 1;
  violationCounts.set(key, count);

  let action = "Removed.";
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (member && SERIOUS_VIOLATION_TIMEOUT_MINUTES > 0) {
    const didTimeout = await timeoutMember(member, SERIOUS_VIOLATION_TIMEOUT_MINUTES, reason);
    if (didTimeout) action = `Timed out ${SERIOUS_VIOLATION_TIMEOUT_MINUTES} min.`;
  }

  await sendModerationLog(
    new EmbedBuilder().setColor("#FF4444").setTitle("🚫 SERIOUS VIOLATION")
      .setDescription(`**Member:** ${message.author}\n**Channel:** ${message.channel}\n**Reason:** ${reason}\n**Count:** ${count}\n**Action:** ${action}`).setTimestamp()
  );
}

async function deleteOnly(message, reason) {
  await message.delete().catch(e => console.error("❌ Delete failed:", e.message));
  console.log(`🗑️ Deleted in #${message.channel.name}: ${reason}`);
}

async function deleteAndModerate(message, reason, serious) {
  await message.delete().catch(e => console.error("❌ Delete failed:", e.message));
  await message.reactions.removeAll().catch(err => console.log('⚠️ Could not remove reactions:', err.message));
  await registerViolation(message, reason, serious);
}

async function processMessage(message, rule) {
  const result = await validateMessage(message, rule);
  if (result.allowed) return { action: "allowed", result };
  
  if (result.serious) {
    await deleteAndModerate(message, result.reason, true);
    return { action: "serious", result };
  }
  
  // Casual/off-topic: DELETE ONLY — no warning, no points
  await deleteOnly(message, result.reason);
  return { action: "deleted", result };
}

// ============================================================
// STARTUP CLEANUP
// ============================================================

async function cleanupChannelOnStartup(channel, rule) {
  if (!channel?.isTextBased() || startupCleanupDone.has(channel.id)) return;
  startupCleanupDone.add(channel.id);

  if (STARTUP_CLEANUP_LIMIT <= 0) {
    console.log(`🧹 Skipped #${channel.name}: startup cleanup disabled`);
    return;
  }

  console.log(`🧹 Cleaning #${channel.name}...`);

  try {
    let before = null, checked = 0, deleted = 0;
    const maximum = STARTUP_DEEP_CLEANUP ? Math.max(STARTUP_CLEANUP_LIMIT, 100) : STARTUP_CLEANUP_LIMIT;

    while (checked < maximum) {
      const remaining = Math.min(100, maximum - checked);
      const options = { limit: remaining, ...(before && { before }) };
      const batch = await channel.messages.fetch(options);
      if (!batch.size) break;

      const messages = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const message of messages) {
        checked++;
        if (message.author.bot) continue;
        const r = await processMessage(message, rule);
        if (r.action === "deleted") deleted++;
        await sleep(350);
        if (checked >= maximum) break;
      }
      before = messages[0]?.id || null;
      if (batch.size < remaining || !STARTUP_DEEP_CLEANUP) break;
    }
    console.log(`🧹 Done #${channel.name}: checked ${checked}, deleted ${deleted}`);
  } catch (e) { console.error(`❌ Cleanup failed #${channel.name}:`, e.message); }
}

async function refreshStickyAfterMessage(channel, rule) {
  await sleep(250);
  await ensureSticky(channel, rule);
}

// ============================================================
// EVENT HANDLERS
// ============================================================

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    const rule = CHANNEL_RULES[message.channel.id];
    if (!rule) return;

    await processMessage(message, rule);
    await refreshStickyAfterMessage(message.channel, rule);
  } catch (e) { console.error("❌ messageCreate error:", e); }
});

client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (user.bot) return;
    const message = reaction.message;
    // Allow reactions on pinned messages — only block on sticky messages
    if (isStickyBotMessage(message)) {
      await reaction.users.remove(user.id);
      console.log(`🚫 Removed reaction from sticky in #${message.channel.name}`);
    }
  } catch (e) { console.error("❌ Reaction error:", e.message); }
});

// ============================================================
// CHANNEL INIT — PINNED FIRST, THEN STICKY
// ============================================================

async function initializeChannel(channelId, rule) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      console.warn(`⚠️ ${channelId} is not text channel.`);
      return;
    }
    
    // ✅ PINNED — ALL channels
    await ensurePinned(channel, rule);
    
    // ✅ STICKY — TEXT CHANNELS ONLY (skipped on Forum)
    await ensureSticky(channel, rule);
    
    await cleanupChannelOnStartup(channel, rule);
  } catch (e) { console.error(`❌ Init failed ${channelId}:`, e.message); }
}

async function initializeChannels() {
  console.log("🚀 Initializing channels...");
  for (const [id, rule] of Object.entries(CHANNEL_RULES)) {
    await initializeChannel(id, rule);
    await sleep(500);
  }
  console.log("✅ All channels initialized.");
}

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [
  new SlashCommandBuilder().setName("sticky-refresh").setDescription("Move sticky to bottom").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName("sticky-remove").setDescription("Remove sticky").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName("sticky-list").setDescription("List all stickies").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName("sticky-setup").setDescription("Create sticky").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName("cleanup").setDescription("Clean channel messages").setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(c => c.toJSON());

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Commands registered.");
  } catch (e) { console.error("❌ Command register failed:", e); }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "❌ Need Manage Messages permission.", ephemeral: true });
    }

    const rule = CHANNEL_RULES[interaction.channelId];

    if (interaction.commandName === "sticky-refresh") {
      if (!rule) return interaction.reply({ content: "❌ No rule for this channel.", ephemeral: true });
      if (interaction.channel.type === ChannelType.GuildForum) {
        return interaction.reply({ content: "ℹ️ Forum channel — no sticky here.", ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      await ensureSticky(interaction.channel, rule);
      return interaction.editReply("✅ Sticky refreshed.");
    }

    if (interaction.commandName === "sticky-setup") {
      if (!rule) return interaction.reply({ content: "❌ No rule for this channel.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      await ensurePinned(interaction.channel, rule);
      await ensureSticky(interaction.channel, rule);
      return interaction.editReply("✅ Pinned + sticky set up.");
    }

    if (interaction.commandName === "sticky-remove") {
      await interaction.deferReply({ ephemeral: true });
      const old = await findExistingSticky(interaction.channel);
      if (old) {
        await old.delete();
        return interaction.editReply("✅ Sticky removed.");
      }
      return interaction.editReply("ℹ️ No sticky found.");
    }

    if (interaction.commandName === "sticky-list") {
      const list = Object.entries(CHANNEL_RULES).map(([id, r]) => {
        const modeNote = r.type === "code" ? " — 6 replies only" :
                         r.type === "build" ? " — HOK chat OK" : "";
        return `• ${PINNED_TITLES[r.type] || r.name}${modeNote} — <#${id}>`;
      }).join("\n");
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(GOLD).setTitle(`${AVISALA} CONFIGURED`).setDescription(list).setTimestamp()], ephemeral: true });
    }

    if (interaction.commandName === "cleanup") {
      if (!rule) return interaction.reply({ content: "❌ No rule for this channel.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      startupCleanupDone.delete(interaction.channelId);
      await cleanupChannelOnStartup(interaction.channel, rule);
      await ensureSticky(interaction.channel, rule);
      return interaction.editReply("✅ Cleanup complete.");
    }
  } catch (e) {
    console.error("❌ Interaction error:", e);
    const msg = "❌ Something went wrong.";
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
    else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
});

// ============================================================
// BOT READY
// ============================================================

client.once("ready", async () => {
  console.log("========================================");
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`🏠 Connected to ${client.guilds.cache.size} guild(s)`);
  console.log(`⏱️ Thresholds: Moderate=${MODERATION_TIMEOUT_MINUTES}m | Repeated=${REPEATED_VIOLATION_TIMEOUT_MINUTES}m | Serious=${SERIOUS_VIOLATION_TIMEOUT_MINUTES}m`);
  console.log(`🧠 Gemini model: ${GEMINI_MODEL}`);
  console.log(`📷 Image moderation: ${genAI ? "✅ Enabled" : "⚠️ Not configured"}`);
  console.log(`🌍 Tagalog support: ✅ Enabled`);
  console.log(`📌 Pinned + 💡 Sticky: SEPARATED — Forum = Pinned ONLY`);
  console.log("🎭 LAMPOON Reminder Bot is online.");
  console.log("========================================");

  await registerCommands();
  await initializeChannels();
});

// ============================================================
// ERROR HANDLING
// ============================================================

client.on("error", (error) => console.error("❌ Discord Error:", error));
client.on("warn", (warning) => console.warn("⚠️ Discord Warn:", warning));
client.on("shardError", (error) => console.error("❌ Shard Error:", error));

process.on("unhandledRejection", (error) => console.error("❌ Unhandled Rejection:", error));
process.on("uncaughtException", (error) => console.error("❌ Uncaught Exception:", error));

process.on("SIGTERM", () => {
  console.log("📤 Shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

// ============================================================
// LOGIN
// ============================================================

client.login(TOKEN)
  .then(() => console.log("🔐 Discord login successful."))
  .catch((error) => console.error("❌ Login failed:", error));
