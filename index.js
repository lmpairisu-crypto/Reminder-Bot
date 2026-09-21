
// ==========================================
// LAMPOON REMINDER BOT
// Clean Moderation + Sticky System
// ==========================================

require("dotenv").config();

const http = require("http");
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

// ==========================================
// ENVIRONMENT
// ==========================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LAMPOON_ICON_URL =
  process.env.LAMPOON_ICON_URL || null;

const MOD_LOG_CHANNEL_ID =
  process.env.MOD_LOG_CHANNEL_ID || null;

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || null;

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || "gpt-5.6-luna";

const MODERATION_TIMEOUT_MINUTES =
  Number(process.env.MODERATION_TIMEOUT_MINUTES) || 10;

const REPEATED_VIOLATION_TIMEOUT_MINUTES =
  Number(process.env.REPEATED_VIOLATION_TIMEOUT_MINUTES) || 30;

const SERIOUS_VIOLATION_TIMEOUT_MINUTES =
  Number(process.env.SERIOUS_VIOLATION_TIMEOUT_MINUTES) || 60;

// ==========================================
// VALIDATION
// ==========================================

if (!TOKEN) {
  throw new Error("Missing DISCORD_TOKEN environment variable.");
}

if (!CLIENT_ID) {
  throw new Error("Missing CLIENT_ID environment variable.");
}

if (!GUILD_ID) {
  throw new Error("Missing GUILD_ID environment variable.");
}

// ==========================================
// RENDER HEALTH CHECK
// ==========================================

const PORT = Number(process.env.PORT) || 10000;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
    });

    return res.end("OK");
  }

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
  });

  res.end("Reminder Bot is online.");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🌐 Reminder Bot health server running on port ${PORT}`
  );
});

// ==========================================
// OPENAI
// ==========================================

const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY,
    })
  : null;

// ==========================================
// DISCORD CLIENT
// ==========================================

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

// ==========================================
// CONSTANTS
// ==========================================

const GOLD = "#D4AF37";

const AVISALA =
  "<a:Avisala:1542448826265243660>";

const STICKY_MARKER =
  "READ CHANNEL'S TOPIC !";

// ==========================================
// CHANNEL RULES
// ==========================================

const CHANNEL_RULES = {

  // ----------------------------------------
  // PROFILE
  // ----------------------------------------

  "1544771901308796929": {
    type: "profile",
    name: "Community Profile Showcase",
    description:
      "Share your Honor of Kings profile screen or profile showcase.",
  },

  "1544183278779764742": {
    type: "profile",
    name: "Lampoon Profile Showcase",
    description:
      "Share your Honor of Kings profile screen or profile showcase.",
  },

  // ----------------------------------------
  // SKIN
  // ----------------------------------------

  "1544771836175196204": {
    type: "skin",
    name: "Community Skin Showcase",
    description:
      "Share Honor of Kings skins, skin previews, collections, reveals, or skin-related screenshots.",
  },

  "1544183056867393599": {
    type: "skin",
    name: "Lampoon Skin Showcase",
    description:
      "Share Honor of Kings skins, skin previews, collections, reveals, or skin-related screenshots.",
  },

  // ----------------------------------------
  // HERO
  // ----------------------------------------

  "1544771692025483315": {
    type: "hero",
    name: "Community Hero Highlight",
    description:
      "Share Honor of Kings Hero Highlight videos.",
  },

  "1544181729097687120": {
    type: "hero",
    name: "Lampoon Hero Highlight",
    description:
      "Share Honor of Kings Hero Highlight videos.",
  },

  // ----------------------------------------
  // MEME
  // ----------------------------------------

  "1541020560929198090": {
    type: "meme",
    name: "Community HOK Meme Share",
    description:
      "Share Honor of Kings memes, funny screenshots, edits, reactions, and parody content.",
  },

  "1543552879942434837": {
    type: "meme",
    name: "Lampoon Standpost Meme",
    description:
      "Share Honor of Kings memes, funny screenshots, edits, reactions, and parody content.",
  },

  // ----------------------------------------
  // EVENT CODE
  // ----------------------------------------

  "1541019893552644187": {
    type: "code",
    name: "Community Event Code Share",
    description:
      "Share valid Honor of Kings event codes and code screenshots.",
  },

  "1544182436353810432": {
    type: "code",
    name: "Lampoon Event Share Code",
    description:
      "Share valid Honor of Kings event codes and code screenshots.",
  },

  // ----------------------------------------
  // FAN ART
  // ----------------------------------------

  "1541020395426283521": {
    type: "fanart",
    name: "Community HOK Fan Art Share",
    description:
      "Share original human-created Honor of Kings fan art.",
  },

  // ----------------------------------------
  // BUILD TIPS
  // ----------------------------------------

  "1541019792394158080": {
    type: "build",
    name: "Community Build Tips Guide",
    description:
      "Share useful Honor of Kings builds, guides, tips, strategies, and educational content.",
  },
};

// ==========================================
// STICKY DISPLAY NAMES
// ==========================================

const STICKY_NAMES = {
  profile: `${AVISALA} PROFILE SHOWCASE`,
  skin: `${AVISALA} SKIN SHOWCASE`,
  hero: `${AVISALA} HERO HIGHLIGHT`,
  meme: `${AVISALA} MEME`,
  code: `${AVISALA} EVENT CODE SHARE`,
  fanart: `${AVISALA} FAN ART`,
  build: `${AVISALA} BUILD TIPS GUIDE`,
};

// ==========================================
// MEMORY
// ==========================================

const stickyMessages = new Map();
const violationCounts = new Map();

// ==========================================
// MEDIA HELPERS
// ==========================================

function isImage(attachment) {
  if (!attachment) return false;

  const contentType =
    attachment.contentType || "";

  const name =
    attachment.name || "";

  return (
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)
  );
}

function isVideo(attachment) {
  if (!attachment) return false;

  const contentType =
    attachment.contentType || "";

  const name =
    attachment.name || "";

  return (
    contentType.startsWith("video/") ||
    /\.(mp4|mov|webm|mkv|avi)$/i.test(name)
  );
}

function getImages(message) {
  return [...message.attachments.values()]
    .filter(isImage);
}

function getVideos(message) {
  return [...message.attachments.values()]
    .filter(isVideo);
}

// ==========================================
// EVENT CODE DETECTION
// ==========================================

function containsPossibleCode(text) {
  if (!text) return false;

  const value = text.trim();

  if (!value) return false;

  // Long alphanumeric codes
  if (
    /\b[A-Z0-9]{4,32}\b/i.test(value)
  ) {
    return true;
  }

  // Codes containing hyphens or underscores
  if (
    /\b[A-Z0-9]{2,16}[-_][A-Z0-9]{2,16}\b/i.test(
      value
    )
  ) {
    return true;
  }

  // Numeric event codes
  if (
    /\b\d{4,32}\b/.test(value)
  ) {
    return true;
  }

  return false;
}

// ==========================================
// CASUAL CHAT DETECTION
// ==========================================

function isCasualChat(text) {
  if (!text) return false;

  const value = text
    .trim()
    .toLowerCase()
    .replace(/[!?.,]+$/g, "");

  const casual = new Set([
    "hi",
    "hello",
    "hey",
    "helo",
    "hii",
    "hiii",
    "good morning",
    "good afternoon",
    "good evening",
    "anyone online",
    "anyone here",
    "who's online",
    "whos online",
    "nice",
    "lol",
    "lmao",
    "haha",
    "hahaha",
    "thanks",
    "thank you",
    "ty",
    "good",
    "cool",
    "wow",
  ]);

  return casual.has(value);
}

// ==========================================
// STICKY EMBED
// ==========================================

function createStickyEmbed(rule) {
  const displayName =
    STICKY_NAMES[rule.type] ||
    `${AVISALA} ${rule.name}`;

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(STICKY_MARKER)
    .setThumbnail(
      LAMPOON_ICON_URL ||
        client.user.displayAvatarURL()
    )
    .setDescription(
      `**${displayName}**\n\n` +
        `${rule.description}\n\n` +
        `💬 **Captions, descriptions, titles and quotes are allowed.**\n\n` +
        `🚫 **Do not reply to another member's post.**\n\n` +
        `🚫 **Unrelated content will be removed.**`
    );
}

// ==========================================
// FIND EXISTING STICKY
// ==========================================

async function findExistingSticky(channel) {
  try {
    const messages = await channel.messages.fetch({
      limit: 100,
    });

    const stickies = messages.filter(
      (message) =>
        message.author.id === client.user.id &&
        message.embeds.some(
          (embed) =>
            embed.title === STICKY_MARKER
        )
    );

    if (!stickies.size) {
      return null;
    }

    const sorted = [...stickies.values()].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    const keeper = sorted[0];

    // Remove duplicates.
    for (const duplicate of sorted.slice(1)) {
      await duplicate.delete().catch(() => {});
    }

    return keeper;
  } catch (error) {
    console.error(
      `❌ Sticky search failed in #${channel.name}:`,
      error.message
    );

    return null;
  }
}

// ==========================================
// ENSURE ONE STICKY
// ==========================================

async function ensureSticky(channel, rule) {
  try {
    let sticky =
      stickyMessages.get(channel.id) || null;

    if (sticky) {
      try {
        sticky = await channel.messages.fetch(
          sticky.id
        );
      } catch {
        sticky = null;
        stickyMessages.delete(channel.id);
      }
    }

    if (!sticky) {
      sticky = await findExistingSticky(channel);
    }

    const embed = createStickyEmbed(rule);

    if (sticky) {
      await sticky.edit({
        embeds: [embed],
      });

      stickyMessages.set(
        channel.id,
        sticky
      );

      return sticky;
    }

    const created = await channel.send({
      embeds: [embed],
    });

    stickyMessages.set(
      channel.id,
      created
    );

    console.log(
      `📌 Sticky created in #${channel.name}`
    );

    return created;
  } catch (error) {
    console.error(
      `❌ Failed to ensure sticky in #${channel.name}:`,
      error.message
    );

    return null;
  }
}

// ==========================================
// REFRESH STICKY
// ==========================================

async function refreshSticky(channel, rule) {
  return ensureSticky(channel, rule);
}

// ==========================================
// STAFF CHECK
// ==========================================

function isStaff(member) {
  if (!member) return false;

  return member.permissions.has(
    PermissionFlagsBits.ManageMessages
  );
}

// ==========================================
// OPENAI IMAGE CLASSIFICATION
// ==========================================

async function classifyImage(
  imageUrl,
  channelType
) {
  if (!openai) {
    console.warn(
      "⚠️ OPENAI_API_KEY is missing. Image classification unavailable."
    );

    return {
      allowed: false,
      serious: false,
      reason:
        "AI image classification is unavailable.",
    };
  }

  let instruction = "";

  // ----------------------------------------
  // PROFILE
  // ----------------------------------------

  if (channelType === "profile") {
    instruction = `
Classify this image for an Honor of Kings PROFILE SHOWCASE channel.

ALLOW only if the image clearly shows an Honor of Kings player profile,
profile screen, profile page, profile showcase, player statistics,
or another clearly recognizable in-game profile interface.

REJECT:
- skins
- gameplay
- random screenshots
- fan art
- memes
- unrelated content
- ambiguous images

Return JSON only:
{
  "allowed": true or false,
  "serious": false,
  "reason": "short reason"
}
`;
  }

  // ----------------------------------------
  // SKIN
  // ----------------------------------------

  else if (channelType === "skin") {
    instruction = `
Classify this image for an Honor of Kings SKIN SHOWCASE channel.

ALLOW if it clearly shows an Honor of Kings:
- skin
- skin preview
- skin collection
- skin card
- skin reveal
- skin animation
- skin obtaining screen
- official in-game skin presentation

REJECT:
- player profile
- ordinary gameplay
- unrelated images
- random screenshots
- fan art
- ambiguous images

Return JSON only:
{
  "allowed": true or false,
  "serious": false,
  "reason": "short reason"
}
`;
  }

  // ----------------------------------------
  // MEME
  // ----------------------------------------

  else if (channelType === "meme") {
    instruction = `
Classify this image for an Honor of Kings MEME channel.

ALLOW:
- Honor of Kings memes
- funny HOK screenshots
- HOK reaction images
- HOK parody
- HOK edits
- humorous HOK images
- HOK GIF-style imagery

REJECT:
- unrelated content
- explicit sexual content
- severe harassment
- hateful targeting of protected classes
- threats
- doxxing
- private information
- self-harm encouragement
- malicious spam or advertisements

A protected-class word by itself is NOT enough to reject an image.

Return JSON only:
{
  "allowed": true or false,
  "serious": true or false,
  "reason": "short reason"
}
`;
  }

  // ----------------------------------------
  // FAN ART
  // ----------------------------------------

  else if (channelType === "fanart") {
    instruction = `
Classify this image for an Honor of Kings FAN ART channel.

ALLOW:
- human-created Honor of Kings fan art
- hand-drawn HOK art
- pencil art
- line art
- digital art
- traditional art
- drawings of HOK heroes or skins

REJECT:
- AI-generated artwork
- ordinary in-game screenshots
- official promotional images
- gameplay screenshots
- memes
- unrelated artwork
- ambiguous images

If you cannot confidently determine that it is human-created HOK fan art,
reject it.

Return JSON only:
{
  "allowed": true or false,
  "serious": false,
  "reason": "short reason"
}
`;
  }

  else {
    return {
      allowed: true,
      serious: false,
      reason: "No image classifier required.",
    };
  }

  try {
    const response =
      await openai.responses.create({
        model: OPENAI_VISION_MODEL,

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",
                text: instruction,
              },

              {
                type: "input_image",
                image_url: imageUrl,
              },
            ],
          },
        ],
      });

    const output =
      response.output_text || "";

    const match =
      output.match(/\{[\s\S]*\}/);

    if (!match) {
      return {
        allowed: false,
        serious: false,
        reason:
          "AI returned an invalid classification.",
      };
    }

    const result =
      JSON.parse(match[0]);

    return {
      allowed: Boolean(result.allowed),
      serious: Boolean(result.serious),
      reason:
        String(result.reason || "No reason provided."),
    };
  } catch (error) {
    console.error(
      "❌ OpenAI image classification failed:",
      error.message
    );

    return {
      allowed: false,
      serious: false,
      reason:
        "Image classification failed.",
    };
  }
}

// ==========================================
// MESSAGE VALIDATION
// ==========================================

async function validateMessage(
  message,
  rule
) {
  // ----------------------------------------
  // REPLIES
  // ----------------------------------------

  if (message.reference) {
    return {
      allowed: false,
      serious: false,
      reason:
        "Replies to another member's post are not allowed in this channel.",
    };
  }

  const images = getImages(message);
  const videos = getVideos(message);

  // ----------------------------------------
  // PROFILE
  // ----------------------------------------

  if (rule.type === "profile") {
    if (!images.length && !videos.length) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A profile image or video is required.",
      };
    }

    if (images.length) {
      const result = await classifyImage(
        images[0].url,
        "profile"
      );

      return result;
    }

    // Videos are structurally accepted.
    return {
      allowed: true,
      serious: false,
      reason: "Profile video accepted.",
    };
  }

  // ----------------------------------------
  // SKIN
  // ----------------------------------------

  if (rule.type === "skin") {
    if (!images.length && !videos.length) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A skin image or video is required.",
      };
    }

    if (images.length) {
      return classifyImage(
        images[0].url,
        "skin"
      );
    }

    return {
      allowed: true,
      serious: false,
      reason: "Skin video accepted.",
    };
  }

  // ----------------------------------------
  // HERO
  // ----------------------------------------

  if (rule.type === "hero") {
    if (!videos.length) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A Hero Highlight video is required.",
      };
    }

    return {
      allowed: true,
      serious: false,
      reason: "Hero Highlight video accepted.",
    };
  }

  // ----------------------------------------
  // MEME
  // ----------------------------------------

  if (rule.type === "meme") {
    if (!images.length && !videos.length) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A meme image or video is required.",
      };
    }

    if (images.length) {
      return classifyImage(
        images[0].url,
        "meme"
      );
    }

    return {
      allowed: true,
      serious: false,
      reason: "Meme video accepted.",
    };
  }

  // ----------------------------------------
  // EVENT CODE
  // ----------------------------------------

  if (rule.type === "code") {
    if (containsPossibleCode(message.content)) {
      return {
        allowed: true,
        serious: false,
        reason:
          "Possible event code detected.",
      };
    }

    if (images.length) {
      return {
        allowed: true,
        serious: false,
        reason:
          "Possible event code screenshot accepted.",
      };
    }

    return {
      allowed: false,
      serious: false,
      reason:
        "A valid event code or code screenshot is required.",
    };
  }

  // ----------------------------------------
  // FAN ART
  // ----------------------------------------

  if (rule.type === "fanart") {
    if (!images.length) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A fan art image is required.",
      };
    }

    return classifyImage(
      images[0].url,
      "fanart"
    );
  }

  // ----------------------------------------
  // BUILD TIPS
  // ----------------------------------------

  if (rule.type === "build") {
    // Media is accepted.
    if (images.length || videos.length) {
      return {
        allowed: true,
        serious: false,
        reason:
          "Build guide media accepted.",
      };
    }

    const text =
      message.content.trim();

    if (isCasualChat(text)) {
      return {
        allowed: false,
        serious: false,
        reason:
          "Casual chat is not allowed in the Build Tips channel.",
      };
    }

    if (text.length < 20) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A useful build guide or detailed tip is required.",
      };
    }

    const hasBuildKeyword =
      /\b(build|arcana|arcane|equipment|item|items|talent|spell|emblem|strategy|guide|damage|defense|lane|hero|roam|jungle|clash|farm|mid|marksman|mage|fighter|tank|support)\b/i.test(
        text
      );

    if (!hasBuildKeyword) {
      return {
        allowed: false,
        serious: false,
        reason:
          "The text does not appear to contain a useful Honor of Kings build or guide.",
      };
    }

    return {
      allowed: true,
      serious: false,
      reason:
        "Build guide text accepted.",
    };
  }

  // ========================================
  // UNKNOWN RULE
  // ========================================

  return {
    allowed: true,
    serious: false,
    reason: "Allowed.",
  };
}

// ==========================================
// MODERATION LOG
// ==========================================

async function sendModerationLog(embed) {
  if (!MOD_LOG_CHANNEL_ID) return;

  try {
    const channel =
      await client.channels.fetch(
        MOD_LOG_CHANNEL_ID
      );

    if (!channel?.isTextBased()) return;

    await channel.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error(
      "❌ Failed to send moderation log:",
      error.message
    );
  }
}

// ==========================================
// TIMEOUT
// ==========================================

async function timeoutMember(
  member,
  minutes,
  reason
) {
  try {
    if (!member) return false;

    if (member.user.bot) return false;

    if (
      member.permissions.has(
        PermissionFlagsBits.ManageMessages
      )
    ) {
      return false;
    }

    const me =
      member.guild.members.me;

    if (!me) return false;

    if (
      !me.permissions.has(
        PermissionFlagsBits.ModerateMembers
      )
    ) {
      console.warn(
        "⚠️ Bot lacks Moderate Members permission."
      );

      return false;
    }

    if (
      member.roles.highest.position >=
      me.roles.highest.position
    ) {
      console.warn(
        `⚠️ Cannot timeout ${member.user.tag}: role hierarchy.`
      );

      return false;
    }

    const duration =
      Math.max(1, minutes) * 60 * 1000;

    await member.timeout(
      duration,
      reason
    );

    await sendModerationLog(
      new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle("⏱️ MEMBER TIMEOUT")
        .setDescription(
          `**Member:** ${member}\n` +
            `**Duration:** ${minutes} minutes\n` +
            `**Reason:** ${reason}`
        )
        .setTimestamp()
    );

    return true;
  } catch (error) {
    console.error(
      `❌ Timeout failed for ${member?.user?.tag}:`,
      error.message
    );

    return false;
  }
}

// ==========================================
// VIOLATION REGISTRATION
// ==========================================

async function registerViolation(
  message,
  reason,
  serious = false
) {
  if (!message.guild) return;

  const key =
    `${message.guild.id}:${message.author.id}`;

  const count =
    (violationCounts.get(key) || 0) + 1;

  violationCounts.set(
    key,
    count
  );

  let action =
    "Warning recorded.";

  // Serious violation
  if (serious) {
    const member =
      await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);

    if (member) {
      const success =
        await timeoutMember(
          member,
          SERIOUS_VIOLATION_TIMEOUT_MINUTES,
          reason
        );

      if (success) {
        action =
          `Timed out for ${SERIOUS_VIOLATION_TIMEOUT_MINUTES} minutes.`;
      }
    }
  }

  // Repeated violation
  else if (count >= 3) {
    const member =
      await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);

    if (member) {
      const success =
        await timeoutMember(
          member,
          REPEATED_VIOLATION_TIMEOUT_MINUTES,
          `Repeated channel violations: ${reason}`
        );

      if (success) {
        action =
          `Repeated violation timeout: ${REPEATED_VIOLATION_TIMEOUT_MINUTES} minutes.`;
      }
    }
  }

  await sendModerationLog(
    new EmbedBuilder()
      .setColor("#FF4444")
      .setTitle("🚫 CHANNEL VIOLATION")
      .setDescription(
        `**Member:** ${message.author}\n` +
          `**Channel:** ${message.channel}\n` +
          `**Reason:** ${reason}\n` +
          `**Violation Count:** ${count}\n` +
          `**Action:** ${action}`
      )
      .setTimestamp()
  );
}

// ==========================================
// REMOVE INVALID MESSAGE
// ==========================================

async function removeMessage(
  message,
  reason,
  serious = false
) {
  try {
    await message.delete();
  } catch (error) {
    console.error(
      "❌ Failed to delete message:",
      error.message
    );
  }

  await registerViolation(
    message,
    reason,
    serious
  );

  const rule =
    CHANNEL_RULES[message.channel.id];

  if (rule) {
    await refreshSticky(
      message.channel,
      rule
    );
  }
}

// ==========================================
// MESSAGE CREATE
// ==========================================

client.on(
  "messageCreate",
  async (message) => {
    try {
      // Ignore bots.
      if (message.author.bot) return;

      // Ignore DMs.
      if (!message.guild) return;

      const rule =
        CHANNEL_RULES[message.channel.id];

      // Ignore channels not controlled by this bot.
      if (!rule) return;

      const member =
        message.member;

      // Staff bypass.
      if (isStaff(member)) {
        await refreshSticky(
          message.channel,
          rule
        );

        return;
      }

      const result =
        await validateMessage(
          message,
          rule
        );

      if (result.allowed) {
        await refreshSticky(
          message.channel,
          rule
        );

        return;
      }

      await removeMessage(
        message,
        result.reason,
        result.serious
      );
    } catch (error) {
      console.error(
        "❌ messageCreate error:",
        error
      );
    }
  }
);

// ==========================================
// STICKY REACTION PROTECTION
// ==========================================
//
// IMPORTANT:
// Normal member posts CAN receive reactions.
//
// ONLY the bot's sticky message is protected.
//
// This prevents the old problem where the bot
// removed reactions from every message in the
// configured channels.
// ==========================================

client.on(
  "messageReactionAdd",
  async (reaction, user) => {
    try {
      if (user.bot) return;

      const message =
        reaction.message;

      const isSticky =
        message.author?.id === client.user.id &&
        message.embeds?.some(
          (embed) =>
            embed.title === STICKY_MARKER
        );

      // Normal member post.
      // Reactions remain untouched.
      if (!isSticky) return;

      // Sticky reaction only.
      await reaction.users.remove(
        user.id
      );

      console.log(
        `🚫 Removed ${user.tag}'s reaction from the sticky in #${message.channel.name}`
      );
    } catch (error) {
      console.error(
        "❌ Sticky reaction protection error:",
        error.message
      );
    }
  }
);

// ==========================================
// STICKY INITIALIZATION
// ==========================================

async function initializeStickies() {
  console.log(
    "📌 Initializing channel stickies..."
  );

  for (
    const [channelId, rule]
    of Object.entries(CHANNEL_RULES)
  ) {
    try {
      const channel =
        await client.channels.fetch(
          channelId
        );

      if (!channel?.isTextBased()) {
        console.warn(
          `⚠️ Channel ${channelId} is not text-based.`
        );

        continue;
      }

      await ensureSticky(
        channel,
        rule
      );
    } catch (error) {
      console.error(
        `❌ Failed to initialize sticky for ${channelId}:`,
        error.message
      );
    }
  }

  console.log(
    "✅ Sticky initialization complete."
  );
}

// ==========================================
// SLASH COMMANDS
// ==========================================

const commands = [

  new SlashCommandBuilder()
    .setName("sticky-refresh")
    .setDescription(
      "Refresh the sticky message in the current channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    ),

  new SlashCommandBuilder()
    .setName("sticky-remove")
    .setDescription(
      "Remove the sticky message from the current channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    ),

  new SlashCommandBuilder()
    .setName("sticky-list")
    .setDescription(
      "Show all configured sticky channels."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    ),

  new SlashCommandBuilder()
    .setName("sticky-setup")
    .setDescription(
      "Create or update the sticky in the current channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    ),

].map((command) =>
  command.toJSON()
);

// ==========================================
// REGISTER COMMANDS
// ==========================================

async function registerCommands() {
  try {
    const rest =
      new REST({ version: "10" })
        .setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      {
        body: commands,
      }
    );

    console.log(
      "✅ Slash commands registered."
    );
  } catch (error) {
    console.error(
      "❌ Slash command registration failed:",
      error
    );
  }
}

// ==========================================
// INTERACTIONS
// ==========================================

client.on(
  "interactionCreate",
  async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      // --------------------------------------
      // PERMISSION
      // --------------------------------------

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return interaction.reply({
          content:
            "❌ You need **Manage Messages** permission to use this command.",
          ephemeral: true,
        });
      }

      // --------------------------------------
      // RULE
      // --------------------------------------

      const rule =
        CHANNEL_RULES[
          interaction.channelId
        ];

      // --------------------------------------
      // STICKY REFRESH
      // --------------------------------------

      if (
        interaction.commandName ===
        "sticky-refresh"
      ) {
        if (!rule) {
          return interaction.reply({
            content:
              "❌ This channel does not have a configured sticky.",
            ephemeral: true,
          });
        }

        await interaction.deferReply({
          ephemeral: true,
        });

        await refreshSticky(
          interaction.channel,
          rule
        );

        return interaction.editReply(
          "✅ Sticky refreshed."
        );
      }

      // --------------------------------------
      // STICKY SETUP
      // --------------------------------------

      if (
        interaction.commandName ===
        "sticky-setup"
      ) {
        if (!rule) {
          return interaction.reply({
            content:
              "❌ This channel does not have a configured sticky.",
            ephemeral: true,
          });
        }

        await interaction.deferReply({
          ephemeral: true,
        });

        await ensureSticky(
          interaction.channel,
          rule
        );

        return interaction.editReply(
          "✅ Sticky created or updated."
        );
      }

      // --------------------------------------
      // STICKY REMOVE
      // --------------------------------------

      if (
        interaction.commandName ===
        "sticky-remove"
      ) {
        await interaction.deferReply({
          ephemeral: true,
        });

        const sticky =
          stickyMessages.get(
            interaction.channelId
          ) ||
          await findExistingSticky(
            interaction.channel
          );

        if (!sticky) {
          return interaction.editReply(
            "ℹ️ No sticky was found in this channel."
          );
        }

        await sticky.delete().catch(() => {});

        stickyMessages.delete(
          interaction.channelId
        );

        return interaction.editReply(
          "✅ Sticky removed."
        );
      }

      // --------------------------------------
      // STICKY LIST
      // --------------------------------------

      if (
        interaction.commandName ===
        "sticky-list"
      ) {
        const entries =
          Object.entries(CHANNEL_RULES);

        const lines = [];

        for (
          const [channelId, channelRule]
          of entries
        ) {
          const channel =
            interaction.guild.channels.cache.get(
              channelId
            );

          const name =
            channel?.name ||
            channelRule.name;

          lines.push(
            `• ${AVISALA} **${name}** — <#${channelId}>`
          );
        }

        const embed =
          new EmbedBuilder()
            .setColor(GOLD)
            .setTitle(
              `${AVISALA} CONFIGURED STICKIES`
            )
            .setDescription(
              lines.join("\n")
            )
            .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error(
        "❌ Interaction error:",
        error
      );

      if (
        interaction.deferred ||
        interaction.replied
      ) {
        await interaction.editReply(
          "❌ Something went wrong."
        ).catch(() => {});
      } else {
        await interaction.reply({
          content:
            "❌ Something went wrong.",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }
);

// ==========================================
// READY
// ==========================================

client.once(
  "clientReady",
  async () => {
    console.log(
      `🤖 Logged in as ${client.user.tag}`
    );

    console.log(
      `🏠 Connected to ${client.guilds.cache.size} guild(s)`
    );

    await registerCommands();

    await initializeStickies();
  }
);

// ==========================================
// DISCORD ERRORS
// ==========================================

client.on(
  "error",
  (error) => {
    console.error(
      "❌ Discord Client Error:",
      error
    );
  }
);

client.on(
  "warn",
  (warning) => {
    console.warn(
      "⚠️ Discord Warning:",
      warning
    );
  }
);

client.on(
  "shardError",
  (error) => {
    console.error(
      "❌ Discord Shard Error:",
      error
    );
  }
);

// ==========================================
// PROCESS ERRORS
// ==========================================

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "❌ Unhandled promise rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "❌ Uncaught exception:",
      error
    );
  }
);

// ==========================================
// LOGIN
// ==========================================

client.login(TOKEN)
  .then(() => {
    console.log(
      "🔐 Discord login successful."
    );
  })
  .catch((error) => {
    console.error(
      "❌ Discord login failed:",
      error
    );
  });
