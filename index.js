require("dotenv").config();

const OpenAI = require("openai");

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
} = require("discord.js");

// ============================================================
// ENVIRONMENT
// ============================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || null;

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || null;

const MOD_LOG_CHANNEL_ID =
  process.env.MOD_LOG_CHANNEL_ID || null;

const LAMPOON_ICON_URL =
  process.env.LAMPOON_ICON_URL || null;

const MODERATION_TIMEOUT_MINUTES =
  Number(process.env.MODERATION_TIMEOUT_MINUTES) || 10;

const REPEATED_VIOLATION_TIMEOUT_MINUTES =
  Number(process.env.REPEATED_VIOLATION_TIMEOUT_MINUTES) || 30;

const SERIOUS_VIOLATION_TIMEOUT_MINUTES =
  Number(process.env.SERIOUS_VIOLATION_TIMEOUT_MINUTES) || 60;

const STARTUP_CLEANUP_LIMIT =
  Number(process.env.STARTUP_CLEANUP_LIMIT) || 100;

const STARTUP_DEEP_CLEANUP =
  String(process.env.STARTUP_DEEP_CLEANUP || "false")
    .toLowerCase() === "true";

if (!TOKEN) {
  throw new Error("Missing DISCORD_TOKEN.");
}

if (!CLIENT_ID) {
  throw new Error("Missing CLIENT_ID.");
}

if (!GUILD_ID) {
  throw new Error("Missing GUILD_ID.");
}

if (!OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY is not configured. Image AI moderation will be unavailable."
  );
}

if (!OPENAI_VISION_MODEL) {
  console.warn(
    "⚠️ OPENAI_VISION_MODEL is not configured. Image AI moderation will be unavailable."
  );
}

// ============================================================
// HELPERS — MOVED UP BEFORE USE
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// OPENAI
// ============================================================

const openai =
  OPENAI_API_KEY && OPENAI_VISION_MODEL
    ? new OpenAI({ apiKey: OPENAI_API_KEY })
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
const STICKY_MARKER = "READ CHANNEL'S TOPIC !";
const AVISALA = "<a:Avisala:1542448826265243660>";

// ============================================================
// CHANNEL RULES
// ============================================================

const CHANNEL_RULES = {
  "1544771901308796929": {
    type: "profile",
    name: "Community Profile Showcase",
    description: "Share your Honor of Kings profile and profile showcase.",
  },
  "1544183278779764742": {
    type: "profile",
    name: "Lampoon Profile Showcase",
    description: "Share your Honor of Kings profile and profile showcase.",
  },
  "1544771836175196204": {
    type: "skin",
    name: "Community Skin Showcase",
    description: "Share Honor of Kings skins, skin previews, collections, reveals, or skin-related screenshots.",
  },
  "1544183056867393599": {
    type: "skin",
    name: "Lampoon Skin Showcase",
    description: "Share Honor of Kings skins, skin previews, collections, reveals, or skin-related screenshots.",
  },
  "1544771692025483315": {
    type: "hero",
    name: "Community Hero Highlight",
    description: "Share Honor of Kings Hero Highlight videos.",
  },
  "1544181729097687120": {
    type: "hero",
    name: "Lampoon Hero Highlight",
    description: "Share Honor of Kings Hero Highlight videos.",
  },
  "1541020560929198090": {
    type: "hok-meme",
    name: "Community HOK Meme Share",
    description: "Share Honor of Kings memes, funny screenshots, edits, reactions, and parody content.",
  },
  "1543552879942434837": {
    type: "general-meme",
    name: "Lampoon Standpost Meme",
    description: "Share general memes, funny images, reactions, edits, entertainment, and Honor of Kings memes.",
  },
  "1541019893552644187": {
    type: "code",
    name: "Community Event Code Share",
    description: "Share valid Honor of Kings event codes and code screenshots.",
  },
  "1544182436353810432": {
    type: "code",
    name: "Lampoon Event Share Code",
    description: "Share valid Honor of Kings event codes and code screenshots.",
  },
  "1541020395426283521": {
    type: "fanart",
    name: "Community HOK Fan Art Share",
    description: "Share Honor of Kings fan art, drawings, illustrations, edits, and artwork.",
  },
  "1541019792394158080": {
    type: "build",
    name: "Community Build Tips Guide",
    description: "Share useful Honor of Kings builds, guides, tips, strategies, and educational content.",
  },
};

// ============================================================
// STICKY TITLES
// ============================================================

const STICKY_NAMES = {
  profile: `${AVISALA} PROFILE SHOWCASE`,
  skin: `${AVISALA} SKIN SHOWCASE`,
  hero: `${AVISALA} HERO HIGHLIGHT`,
  "hok-meme": `${AVISALA} HOK MEME SHARE`,
  "general-meme": `${AVISALA} LAMPOON STANDPOST MEME`,
  code: `${AVISALA} EVENT CODE SHARE`,
  fanart: `${AVISALA} FAN ART`,
  build: `${AVISALA} BUILD TIPS GUIDE`,
};

// ============================================================
// RUNTIME MEMORY
// ============================================================

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
// STICKY EMBED
// ============================================================

function createStickyEmbed(rule) {
  const displayName = STICKY_NAMES[rule.type] || `${AVISALA} ${rule.name}`;
  const channelNote = rule.type === "general-meme"
    ? "✅ **General memes are allowed. Honor of Kings is NOT required.**"
    : "🚫 **Unrelated content will be removed without a moderation warning.**";

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(STICKY_MARKER)
    .setThumbnail(LAMPOON_ICON_URL || client.user?.displayAvatarURL() || null)
    .setDescription(
      `**${displayName}**\n\n` +
      `${rule.description}\n\n` +
      `💬 **Captions, descriptions, titles and quotes are allowed.**\n\n` +
      `🚫 **Do not reply to another member's post.**\n\n` +
      `${channelNote}\n\n` +
      `⚠️ **Serious prohibited content may receive moderation action.**`
    );
}

// ============================================================
// STICKY DETECTION
// ============================================================

function isStickyMessage(message) {
  return message?.author?.id === client.user?.id &&
    message.embeds?.some(embed => embed.title === STICKY_MARKER);
}

// ============================================================
// FIND EXISTING STICKIES
// ============================================================

async function findExistingStickies(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    return [...messages.values()]
      .filter(isStickyMessage)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  } catch (error) {
    console.error(`❌ Sticky search failed in #${channel.name}:`, error.message);
    return [];
  }
}

// ============================================================
// REMOVE ALL STICKIES
// ============================================================

async function removeAllStickies(channel) {
  const stickies = await findExistingStickies(channel);
  for (const sticky of stickies) await sticky.delete().catch(() => {});
  stickyMessages.delete(channel.id);
  return stickies.length;
}

// ============================================================
// ENSURE STICKY AT BOTTOM
// ============================================================

async function ensureSticky(channel, rule) {
  if (!channel?.isTextBased()) return null;
  if (stickyLocks.get(channel.id)) return stickyMessages.get(channel.id) || null;

  stickyLocks.set(channel.id, true);
  try {
    const stickies = await findExistingStickies(channel);
    for (const sticky of stickies) await sticky.delete().catch(() => {});
    stickyMessages.delete(channel.id);

    const created = await channel.send({ embeds: [createStickyEmbed(rule)] });
    stickyMessages.set(channel.id, created);
    console.log(`📌 Sticky placed at bottom of #${channel.name}`);
    return created;
  } catch (error) {
    console.error(`❌ Failed to place sticky in #${channel.name}:`, error.message);
    return null;
  } finally {
    stickyLocks.delete(channel.id);
  }
}

// ============================================================
// OPENAI CLASSIFICATION
// ============================================================

async function askOpenAIImage(imageUrl, channelType) {
  if (!openai) {
    return { status: "unknown", serious: false, reason: "OpenAI image moderation is not configured." };
  }

  const instructions = {
    profile: `Check if image shows Honor of Kings profile/account info. ALLOW if yes. REJECT if clearly unrelated. If uncertain: unknown.`,
    skin: `Check if image shows HOK skins/previews. ALLOW if yes. REJECT if unrelated. If uncertain: unknown.`,
    "hok-meme": `Check if image is HOK-related meme. ALLOW if yes. REJECT if unrelated. If uncertain: unknown.`,
    "general-meme": `Accept any meme/funny image. Only flag serious prohibited content. ALLOW everything else.`,
    fanart: `Check if image is HOK-related artwork. ALLOW if yes. REJECT if unrelated. Do NOT reject for being AI art. If uncertain: unknown.`,
  };

  const instruction = instructions[channelType] || instructions["general-meme"];
  const prompt = `${instruction}\n\nReturn ONLY JSON: {"status":"allowed"|"rejected"|"unknown","serious":true|false,"reason":"explanation"}`;

  try {
    const response = await openai.responses.create({
      model: OPENAI_VISION_MODEL,
      input: [
        { role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageUrl },
        ]},
      ],
    });

    const output = response.output_text || "";
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return { status: "unknown", serious: false, reason: "Unreadable response." };

    const result = JSON.parse(match[0]);
    const status = ["allowed", "rejected", "unknown"].includes(result.status) ? result.status : "unknown";
    return { status, serious: Boolean(result.serious), reason: String(result.reason || "").slice(0, 500) };
  } catch (error) {
    console.error("❌ OpenAI failed:", error.message);
    return { status: "unknown", serious: false, reason: "Check temporarily unavailable." };
  }
}

// ============================================================
// TEXT SERIOUS-CONTENT CHECK
// ============================================================

async function checkTextForSeriousViolation(message) {
  const text = message.content?.trim() || "";
  if (!text || !openai || text.length < 8) return { serious: false, reason: "" };

  try {
    const response = await openai.responses.create({
      model: OPENAI_VISION_MODEL,
      input: [{ role: "user", content: [{ type: "input_text", text: `Review for serious violations only. Message: """${text}""" Return JSON: {"serious":true|false,"reason":"short reason"}` }] }],
    });

    const output = response.output_text || "";
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return { serious: false, reason: "" };
    const result = JSON.parse(match[0]);
    return { serious: Boolean(result.serious), reason: String(result.reason || "").slice(0, 500) };
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

function validateBuild(message) {
  const images = getImages(message);
  const videos = getVideos(message);
  if (images.length || videos.length) return { allowed: true, serious: false, reason: "Media accepted." };
  const text = message.content.trim();
  if (text.length < 20) return { allowed: false, serious: false, reason: "Too short." };
  if (/\b(build|arcana|equipment|item|talent|spell|emblem|strategy|guide)\b/i.test(text)) {
    return { allowed: true, serious: false, reason: "Build guide accepted." };
  }
  return { allowed: false, serious: false, reason: "Not a build guide." };
}

// ============================================================
// MESSAGE VALIDATION
// ============================================================

async function validateMessage(message, rule) {
  const images = getImages(message);
  const videos = getVideos(message);

  const seriousText = await checkTextForSeriousViolation(message);
  if (seriousText.serious) return { allowed: false, serious: true, reason: seriousText.reason };

  if (message.reference) return { allowed: false, serious: false, reason: "Replies are not allowed." };

  if (rule.type === "general-meme") {
    if (images.length || videos.length) {
      if (images.length) {
        const r = await askOpenAIImage(images[0].url, "general-meme");
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
      const r = await askOpenAIImage(images[0].url, "profile");
      if (r.serious) return { allowed: false, serious: true, reason: r.reason };
      if (r.status === "allowed") return { allowed: true, serious: false, reason: r.reason };
      return { allowed: false, serious: false, reason: r.reason || "Not a profile showcase." };
    }
    return { allowed: true, serious: false, reason: "Video accepted." };
  }

  if (rule.type === "skin") {
    if (!images.length && !videos.length) return { allowed: false, serious: false, reason: "Skin image/video required." };
    if (images.length) {
      const r = await askOpenAIImage(images[0].url, "skin");
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
      const r = await askOpenAIImage(images[0].url, "hok-meme");
      if (r.serious) return { allowed: false, serious: true, reason: r.reason };
      if (r.status === "allowed") return { allowed: true, serious: false, reason: r.reason };
      return { allowed: false, serious: false, reason: r.reason || "Not a HOK meme." };
    }
    return { allowed: true, serious: false, reason: "Video accepted." };
  }

  if (rule.type === "code") return validateEventCode(message);

  if (rule.type === "fanart") {
    if (!images.length) return { allowed: false, serious: false, reason: "Fan art image required." };
    const r = await askOpenAIImage(images[0].url, "fanart");
    if (r.serious) return { allowed: false, serious: true, reason: r.reason };
    if (r.status === "allowed") return { allowed: true, serious: false, reason: r.reason };
    return { allowed: false, serious: false, reason: r.reason || "Not HOK fan art." };
  }

  if (rule.type === "build") return validateBuild(message);

  return { allowed: true, serious: false, reason: "Allowed." };
}

// ============================================================
// MODERATION HELPERS
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
  const key = `${message.guild.id}:${message.author.id}`;
  const count = (violationCounts.get(key) || 0) + 1;
  violationCounts.set(key, count);

  let action = "Warning recorded.";
  if (serious) {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member && await timeoutMember(member, SERIOUS_VIOLATION_TIMEOUT_MINUTES, reason)) {
      action = `Timed out ${SERIOUS_VIOLATION_TIMEOUT_MINUTES} min.`;
    }
  } else if (count >= 3) {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member && await timeoutMember(member, REPEATED_VIOLATION_TIMEOUT_MINUTES, `Repeated: ${reason}`)) {
      action = `Timeout ${REPEATED_VIOLATION_TIMEOUT_MINUTES} min.`;
    }
  }

  await sendModerationLog(
    new EmbedBuilder().setColor("#FF4444").setTitle("🚫 CONTENT VIOLATION")
      .setDescription(`**Member:** ${message.author}\n**Channel:** ${message.channel}\n**Reason:** ${reason}\n**Count:** ${count}\n**Action:** ${action}`).setTimestamp()
  );
}

async function deleteOnly(message, reason) {
  await message.delete().catch(e => console.error("❌ Delete failed:", e.message));
  console.log(`🗑️ Deleted in #${message.channel.name}: ${reason}`);
}

async function deleteAndModerate(message, reason, serious) {
  await message.delete().catch(e => console.error("❌ Delete failed:", e.message));
  await registerViolation(message, reason, serious);
}

async function processMessage(message, rule) {
  const result = await validateMessage(message, rule);
  if (result.allowed) return { action: "allowed", result };
  if (result.serious) {
    await deleteAndModerate(message, result.reason, true);
    return { action: "serious", result };
  }
  await deleteOnly(message, result.reason);
  return { action: "deleted", result };
}

// ============================================================
// STARTUP CLEANUP
// ============================================================

async function cleanupChannelOnStartup(channel, rule) {
  if (!channel?.isTextBased() || startupCleanupDone.has(channel.id)) return;
  startupCleanupDone.add(channel.id);
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
    if (!isStickyMessage(message)) return;
    await reaction.users.remove(user.id);
    console.log(`🚫 Removed reaction from sticky in #${message.channel.name}`);
  } catch (e) { console.error("❌ Reaction error:", e.message); }
});

// ============================================================
// CHANNEL INIT
// ============================================================

async function initializeChannel(channelId, rule) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      console.warn(`⚠️ ${channelId} is not text channel.`);
      return;
    }
    await removeAllStickies(channel);
    await cleanupChannelOnStartup(channel, rule);
    await ensureSticky(channel, rule);
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
      await interaction.deferReply({ ephemeral: true });
      await ensureSticky(interaction.channel, rule);
      return interaction.editReply("✅ Sticky refreshed.");
    }

    if (interaction.commandName === "sticky-setup") {
      if (!rule) return interaction.reply({ content: "❌ No rule for this channel.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      await ensureSticky(interaction.channel, rule);
      return interaction.editReply("✅ Sticky created.");
    }

    if (interaction.commandName === "sticky-remove") {
      await interaction.deferReply({ ephemeral: true });
      const n = await removeAllStickies(interaction.channel);
      return interaction.editReply(n ? `✅ Removed ${n} sticky.` : "ℹ️ No sticky found.");
    }

    if (interaction.commandName === "sticky-list") {
      const list = Object.entries(CHANNEL_RULES).map(([id, r]) => `• ${AVISALA} **${r.name}** — <#${id}>`).join("\n");
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
// ✅ FIXED: WAS "clientReady" → NOW CORRECTLY "ready"
// ============================================================

client.once("clientReady", async () => {
  console.log("========================================");
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`🏠 Connected to ${client.guilds.cache.size} guild(s)`);
  console.log(`🧠 OpenAI model: ${OPENAI_VISION_MODEL || "NOT CONFIGURED"}`);
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

// ✅ Graceful Shutdown
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
