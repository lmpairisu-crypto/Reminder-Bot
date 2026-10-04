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

// Number of old messages checked when bot starts.
// Discord fetches messages in batches of 100.
const STARTUP_CLEANUP_LIMIT =
  Number(process.env.STARTUP_CLEANUP_LIMIT) || 100;

// Set true if you want startup cleanup to process
// messages older than the first batch by repeatedly fetching.
// Be careful with large channels/rate limits.
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
// OPENAI
// ============================================================

const openai =
  OPENAI_API_KEY && OPENAI_VISION_MODEL
    ? new OpenAI({
        apiKey: OPENAI_API_KEY,
      })
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

const STICKY_MARKER =
  "READ CHANNEL'S TOPIC !";

const AVISALA =
  "<a:Avisala:1542448826265243660>";

// ============================================================
// CHANNEL RULES
// ============================================================

const CHANNEL_RULES = {

  // ==========================================================
  // PROFILE SHOWCASE
  // ==========================================================

  "1544771901308796929": {
    type: "profile",
    name: "Community Profile Showcase",
    description:
      "Share your Honor of Kings profile and profile showcase.",
  },

  "1544183278779764742": {
    type: "profile",
    name: "Lampoon Profile Showcase",
    description:
      "Share your Honor of Kings profile and profile showcase.",
  },

  // ==========================================================
  // SKIN SHOWCASE
  // ==========================================================

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

  // ==========================================================
  // HERO HIGHLIGHT
  // ==========================================================

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

  // ==========================================================
  // MEME
  // ==========================================================

  "1541020560929198090": {
    type: "hok-meme",
    name: "Community HOK Meme Share",
    description:
      "Share Honor of Kings memes, funny screenshots, edits, reactions, and parody content.",
  },

  "1543552879942434837": {
    type: "general-meme",
    name: "Lampoon Standpost Meme",
    description:
      "Share general memes, funny images, reactions, edits, entertainment, and Honor of Kings memes.",
  },

  // ==========================================================
  // EVENT CODE
  // ==========================================================

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

  // ==========================================================
  // FAN ART
  // ==========================================================

  "1541020395426283521": {
    type: "fanart",
    name: "Community HOK Fan Art Share",
    description:
      "Share Honor of Kings fan art, drawings, illustrations, edits, and artwork.",
  },

  // ==========================================================
  // BUILD TIPS
  // ==========================================================

  "1541019792394158080": {
    type: "build",
    name: "Community Build Tips Guide",
    description:
      "Share useful Honor of Kings builds, guides, tips, strategies, and educational content.",
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

// Prevent multiple sticky operations from fighting each other.
const stickyLocks = new Map();

// Prevent multiple startup scans.
const startupCleanupDone = new Set();

// ============================================================
// MEDIA HELPERS
// ============================================================

function isImage(attachment) {
  if (!attachment) return false;

  const contentType =
    attachment.contentType || "";

  const name =
    attachment.name || "";

  return (
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(name)
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

// ============================================================
// EVENT CODE DETECTION
// ============================================================

function containsPossibleCode(text) {
  if (!text) return false;

  const value = text.trim();

  return (
    /\b[A-Z0-9]{4,32}\b/i.test(value) ||
    /\b[A-Z0-9]{2,16}[-_][A-Z0-9]{2,16}\b/i.test(value) ||
    /\b\d{4,32}\b/.test(value)
  );
}

// ============================================================
// STICKY EMBED
// ============================================================

function createStickyEmbed(rule) {
  const displayName =
    STICKY_NAMES[rule.type] ||
    `${AVISALA} ${rule.name}`;

  let channelNote =
    "🚫 **Unrelated content will be removed without a moderation warning.**";

  if (rule.type === "general-meme") {
    channelNote =
      "✅ **General memes are allowed. Honor of Kings is NOT required.**";
  }

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(STICKY_MARKER)
    .setThumbnail(
      LAMPOON_ICON_URL ||
        client.user?.displayAvatarURL() ||
        null
    )
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
  return (
    message?.author?.id === client.user?.id &&
    message.embeds?.some(
      (embed) =>
        embed.title === STICKY_MARKER
    )
  );
}

// ============================================================
// FIND EXISTING STICKIES
// ============================================================

async function findExistingStickies(channel) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 100,
      });

    return [...messages.values()]
      .filter(isStickyMessage)
      .sort(
        (a, b) =>
          a.createdTimestamp -
          b.createdTimestamp
      );
  } catch (error) {
    console.error(
      `❌ Sticky search failed in #${channel.name}:`,
      error.message
    );

    return [];
  }
}

// ============================================================
// DELETE ALL OLD STICKIES
// ============================================================

async function removeAllStickies(channel) {
  const stickies =
    await findExistingStickies(channel);

  for (const sticky of stickies) {
    await sticky.delete().catch(() => {});
  }

  stickyMessages.delete(channel.id);

  return stickies.length;
}

// ============================================================
// ENSURE STICKY AT BOTTOM
// ============================================================

async function ensureSticky(channel, rule) {
  if (!channel?.isTextBased()) {
    return null;
  }

  if (stickyLocks.get(channel.id)) {
    return stickyMessages.get(channel.id) || null;
  }

  stickyLocks.set(channel.id, true);

  try {
    // Find every sticky.
    const stickies =
      await findExistingStickies(channel);

    // Keep none. We recreate the sticky as the
    // newest message. This guarantees bottom position.
    for (const sticky of stickies) {
      await sticky.delete().catch(() => {});
    }

    stickyMessages.delete(channel.id);

    const created =
      await channel.send({
        embeds: [
          createStickyEmbed(rule),
        ],
      });

    stickyMessages.set(
      channel.id,
      created
    );

    console.log(
      `📌 Sticky placed at bottom of #${channel.name}`
    );

    return created;
  } catch (error) {
    console.error(
      `❌ Failed to place sticky in #${channel.name}:`,
      error.message
    );

    return null;
  } finally {
    stickyLocks.delete(channel.id);
  }
}

// ============================================================
// OPENAI CLASSIFICATION
// ============================================================

async function askOpenAIImage(
  imageUrl,
  channelType
) {
  if (!openai) {
    return {
      status: "unknown",
      serious: false,
      reason:
        "OpenAI image moderation is not configured.",
    };
  }

  const instructions = {

    profile: `
You are checking an image submitted to an Honor of Kings PROFILE SHOWCASE channel.

ALLOW if it reasonably shows Honor of Kings account/profile-related information.

Examples of ALLOWED profile/showcase content:
- Player profile
- Titles
- Badges
- Profile gallery
- Lane tier
- Hero tier
- Hero power
- Nobility/VIP/account status
- Profile statistics
- Achievements
- HOK account information
- HOK profile customization
- Other clearly identifiable HOK profile pages

Do NOT reject simply because the screen is not literally called "Profile".

Do NOT reject a legitimate HOK profile-related screen merely because it also contains
other interface elements.

If the image is clearly unrelated to Honor of Kings, reject it.

If uncertain, use "unknown" rather than inventing a violation.
`,

    skin: `
You are checking an image for an Honor of Kings SKIN SHOWCASE channel.

ALLOW:
- HOK skins
- Skin previews
- Skin collections
- Skin cards
- Skin reveals
- Skin animations
- HOK skin-related screenshots

If clearly unrelated to HOK, reject it.

If uncertain, use "unknown".
`,

    "hok-meme": `
You are checking an image for an Honor of Kings MEME SHARE channel.

ALLOW:
- Honor of Kings memes
- HOK funny screenshots
- HOK reactions
- HOK parody
- HOK edits
- Humorous HOK content

Do NOT require a specific hero to be visible.

Reject if clearly unrelated to Honor of Kings.

IMPORTANT:
This is a content relevance check, not an AI-art detector.

If the image appears to be artwork, do not claim it is AI-generated
just because of its visual style.

If uncertain, use "unknown".
`,

    "general-meme": `
You are checking an image for the LAMPOON STANDPOST MEME channel.

This channel accepts GENERAL MEMES.

Honor of Kings is NOT required.

ALLOW:
- General internet memes
- HOK memes
- Funny images
- Reaction images
- Meme edits
- Collages
- Entertainment images
- Current/trending memes
- Random humorous memes
- General artwork used as a meme

ONLY flag the image for a serious violation if there is clear evidence of:
- Explicit sexual/pornographic content
- Sexual content involving minors
- Serious targeted harassment
- Threats
- Doxxing/private personal information
- Severe hateful targeting
- Self-harm encouragement
- Malicious/scam content

Do NOT reject simply because the image is unrelated to Honor of Kings.

Do NOT call artwork AI-generated merely because it looks AI-like.

If uncertain, use "unknown".
`,

    fanart: `
You are checking an image for an Honor of Kings FAN ART channel.

ALLOW:
- HOK hero art
- HOK skin art
- HOK character drawings
- Traditional artwork
- Digital artwork
- Pencil/line art
- Paintings
- Illustrations
- Fan-made edits

Do NOT treat "looks AI-generated" as proof that an image is AI-generated.

The bot must NOT reject artwork solely because an AI detector or visual impression
suggests it may be AI-generated.

If it is clearly unrelated to Honor of Kings, reject it.

If uncertain, use "unknown".
`,
  };

  const instruction =
    instructions[channelType] ||
    instructions["general-meme"];

  const prompt = `
${instruction}

Return ONLY valid JSON in exactly this structure:

{
  "status": "allowed" | "rejected" | "unknown",
  "serious": true | false,
  "reason": "short explanation"
}

Rules:
- "serious": true ONLY for clear serious prohibited content.
- Off-topic content is NOT serious.
- Do not invent facts that cannot be seen.
- Do not identify an image as AI-generated merely because it looks AI-generated.
`;

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
                text: prompt,
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
        status: "unknown",
        serious: false,
        reason:
          "OpenAI returned an unreadable classification.",
      };
    }

    const result =
      JSON.parse(match[0]);

    const status =
      ["allowed", "rejected", "unknown"]
        .includes(result.status)
        ? result.status
        : "unknown";

    return {
      status,
      serious: Boolean(result.serious),
      reason:
        String(
          result.reason ||
            "No reason provided."
        ).slice(0, 500),
    };
  } catch (error) {
    console.error(
      "❌ OpenAI image classification failed:",
      error.message
    );

    return {
      status: "unknown",
      serious: false,
      reason:
        "Image classification temporarily failed.",
    };
  }
}

// ============================================================
// TEXT SERIOUS-CONTENT CHECK
// ============================================================

async function checkTextForSeriousViolation(
  message
) {
  const text =
    message.content?.trim() || "";

  if (!text || !openai) {
    return {
      serious: false,
      reason: "",
    };
  }

  // Very short normal chat should not be sent to AI.
  if (text.length < 8) {
    return {
      serious: false,
      reason: "",
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
                text: `
Review this Discord message ONLY for clear serious prohibited content.

Message:
"""${text}"""

Return ONLY JSON:

{
  "serious": true | false,
  "reason": "short reason"
}

Mark serious=true only for clear:
- threats
- targeted severe harassment
- explicit sexual content
- sexual content involving minors
- doxxing/private information
- severe hateful targeting
- self-harm encouragement
- malicious/scam activity

Normal conversation, jokes, profanity, arguments, or off-topic discussion
must NOT automatically be classified as serious.
`,
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
        serious: false,
        reason: "",
      };
    }

    const result =
      JSON.parse(match[0]);

    return {
      serious: Boolean(result.serious),
      reason:
        String(
          result.reason || ""
        ).slice(0, 500),
    };
  } catch (error) {
    console.error(
      "❌ Text moderation check failed:",
      error.message
    );

    return {
      serious: false,
      reason: "",
    };
  }
}

// ============================================================
// EVENT CODE DETECTION
// ============================================================

function validateEventCode(message) {
  const images =
    getImages(message);

  if (
    containsPossibleCode(
      message.content
    )
  ) {
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
      "No event code or code screenshot was found.",
  };
}

// ============================================================
// BUILD VALIDATION
// ============================================================

function validateBuild(message) {
  const images =
    getImages(message);

  const videos =
    getVideos(message);

  if (
    images.length ||
    videos.length
  ) {
    return {
      allowed: true,
      serious: false,
      reason:
        "Build guide media accepted.",
    };
  }

  const text =
    message.content.trim();

  if (text.length < 20) {
    return {
      allowed: false,
      serious: false,
      reason:
        "Short casual text is not a build guide.",
    };
  }

  const hasBuildKeyword =
    /\b(build|arcana|equipment|item|items|talent|spell|emblem|strategy|guide|damage|defense|lane|hero|roam|jungle|clash|farm|mid|marksman|mage|fighter|tank|support)\b/i
      .test(text);

  if (!hasBuildKeyword) {
    return {
      allowed: false,
      serious: false,
      reason:
        "The text does not appear to contain an Honor of Kings build or guide.",
    };
  }

  return {
    allowed: true,
    serious: false,
    reason:
      "Build guide text accepted.",
  };
}

// ============================================================
// MESSAGE VALIDATION
// ============================================================

async function validateMessage(
  message,
  rule
) {
  const images =
    getImages(message);

  const videos =
    getVideos(message);

  // ==========================================================
  // FIRST: CHECK SERIOUS TEXT VIOLATIONS
  // ==========================================================

  const seriousText =
    await checkTextForSeriousViolation(
      message
    );

  if (seriousText.serious) {
    return {
      allowed: false,
      serious: true,
      reason:
        seriousText.reason ||
        "Serious prohibited content.",
    };
  }

  // ==========================================================
  // REPLIES
  // ==========================================================

  if (message.reference) {
    return {
      allowed: false,
      serious: false,
      reason:
        "Replies to another member's post are not allowed in this channel.",
    };
  }

  // ==========================================================
  // GENERAL MEME
  // ==========================================================

  if (rule.type === "general-meme") {

    // General memes do NOT require HOK.
    if (
      images.length ||
      videos.length
    ) {
      if (images.length) {
        const result =
          await askOpenAIImage(
            images[0].url,
            "general-meme"
          );

        if (result.serious) {
          return {
            allowed: false,
            serious: true,
            reason: result.reason,
          };
        }

        if (
          result.status === "rejected"
        ) {
          return {
            allowed: false,
            serious: false,
            reason: result.reason,
          };
        }
      }

      return {
        allowed: true,
        serious: false,
        reason:
          "General meme accepted.",
      };
    }

    // Text-only meme/caption/chat is allowed.
    if (message.content.trim()) {
      return {
        allowed: true,
        serious: false,
        reason:
          "General meme text accepted.",
      };
    }

    return {
      allowed: false,
      serious: false,
      reason:
        "Empty message.",
    };
  }

  // ==========================================================
  // PROFILE
  // ==========================================================

  if (rule.type === "profile") {

    if (
      !images.length &&
      !videos.length
    ) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A Honor of Kings profile/showcase image or video is required.",
      };
    }

    if (images.length) {
      const result =
        await askOpenAIImage(
          images[0].url,
          "profile"
        );

      if (result.serious) {
        return {
          allowed: false,
          serious: true,
          reason: result.reason,
        };
      }

      if (
        result.status === "allowed"
      ) {
        return {
          allowed: true,
          serious: false,
          reason:
            result.reason,
        };
      }

      // Unknown/rejected = cleanup, not warning.
      return {
        allowed: false,
        serious: false,
        reason:
          result.reason ||
          "The image does not appear to be an HOK profile showcase.",
      };
    }

    return {
      allowed: true,
      serious: false,
      reason:
        "Profile video accepted.",
    };
  }

  // ==========================================================
  // SKIN
  // ==========================================================

  if (rule.type === "skin") {

    if (
      !images.length &&
      !videos.length
    ) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A Honor of Kings skin image or video is required.",
      };
    }

    if (images.length) {
      const result =
        await askOpenAIImage(
          images[0].url,
          "skin"
        );

      if (result.serious) {
        return {
          allowed: false,
          serious: true,
          reason: result.reason,
        };
      }

      if (
        result.status === "allowed"
      ) {
        return {
          allowed: true,
          serious: false,
          reason:
            result.reason,
        };
      }

      return {
        allowed: false,
        serious: false,
        reason:
          result.reason ||
          "The image does not appear to be an HOK skin showcase.",
      };
    }

    return {
      allowed: true,
      serious: false,
      reason:
        "Skin video accepted.",
    };
  }

  // ==========================================================
  // HERO
  // ==========================================================

  if (rule.type === "hero") {

    if (!videos.length) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A Honor of Kings Hero Highlight video is required.",
      };
    }

    return {
      allowed: true,
      serious: false,
      reason:
        "Hero Highlight video accepted.",
    };
  }

  // ==========================================================
  // HOK MEME
  // ==========================================================

  if (rule.type === "hok-meme") {

    if (
      !images.length &&
      !videos.length
    ) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A Honor of Kings meme image or video is required.",
      };
    }

    if (images.length) {
      const result =
        await askOpenAIImage(
          images[0].url,
          "hok-meme"
        );

      if (result.serious) {
        return {
          allowed: false,
          serious: true,
          reason: result.reason,
        };
      }

      if (
        result.status === "allowed"
      ) {
        return {
          allowed: true,
          serious: false,
          reason:
            result.reason,
        };
      }

      return {
        allowed: false,
        serious: false,
        reason:
          result.reason ||
          "The image does not appear to be an HOK meme.",
      };
    }

    return {
      allowed: true,
      serious: false,
      reason:
        "HOK meme video accepted.",
    };
  }

  // ==========================================================
  // EVENT CODE
  // ==========================================================

  if (rule.type === "code") {
    return validateEventCode(message);
  }

  // ==========================================================
  // FAN ART
  // ==========================================================

  if (rule.type === "fanart") {

    if (!images.length) {
      return {
        allowed: false,
        serious: false,
        reason:
          "A Honor of Kings fan-art image is required.",
      };
    }

    const result =
      await askOpenAIImage(
        images[0].url,
        "fanart"
      );

    if (result.serious) {
      return {
        allowed: false,
        serious: true,
        reason: result.reason,
      };
    }

    if (
      result.status === "allowed"
    ) {
      return {
        allowed: true,
        serious: false,
        reason:
          result.reason,
      };
    }

    return {
      allowed: false,
      serious: false,
      reason:
        result.reason ||
        "The image does not appear to be Honor of Kings fan art.",
    };
  }

  // ==========================================================
  // BUILD TIPS
  // ==========================================================

  if (rule.type === "build") {
    return validateBuild(message);
  }

  // ==========================================================
  // DEFAULT
  // ==========================================================

  return {
    allowed: true,
    serious: false,
    reason:
      "Allowed.",
  };
}

// ============================================================
// MODERATION LOG
// ============================================================

async function sendModerationLog(embed) {
  if (!MOD_LOG_CHANNEL_ID) {
    return;
  }

  try {
    const channel =
      await client.channels.fetch(
        MOD_LOG_CHANNEL_ID
      );

    if (!channel?.isTextBased()) {
      return;
    }

    await channel.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error(
      "❌ Moderation log failed:",
      error.message
    );
  }
}

// ============================================================
// TIMEOUT
// ============================================================

async function timeoutMember(
  member,
  minutes,
  reason
) {
  try {
    if (
      !member ||
      member.user.bot
    ) {
      return false;
    }

    const me =
      member.guild.members.me;

    if (!me) {
      return false;
    }

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

    await member.timeout(
      Math.max(1, minutes) *
        60 *
        1000,
      reason
    );

    await sendModerationLog(
      new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle(
          "⏱️ MEMBER TIMEOUT"
        )
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

// ============================================================
// REGISTER REAL VIOLATION
// ============================================================

async function registerViolation(
  message,
  reason,
  serious = false
) {
  if (!message.guild) {
    return;
  }

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

  } else if (count >= 3) {

    const member =
      await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);

    if (member) {
      const success =
        await timeoutMember(
          member,
          REPEATED_VIOLATION_TIMEOUT_MINUTES,
          `Repeated serious/content violations: ${reason}`
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
      .setTitle(
        "🚫 CONTENT VIOLATION"
      )
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

// ============================================================
// DELETE ONLY
// ============================================================

async function deleteOnly(
  message,
  reason
) {
  try {
    await message.delete();
  } catch (error) {
    console.error(
      "❌ Delete-only action failed:",
      error.message
    );
  }

  console.log(
    `🗑️ Deleted off-topic/invalid message in #${message.channel.name}: ${reason}`
  );
}

// ============================================================
// DELETE + REAL MODERATION
// ============================================================

async function deleteAndModerate(
  message,
  reason,
  serious
) {
  try {
    await message.delete();
  } catch (error) {
    console.error(
      "❌ Message deletion failed:",
      error.message
    );
  }

  await registerViolation(
    message,
    reason,
    serious
  );
}

// ============================================================
// PROCESS ONE MESSAGE
// ============================================================

async function processMessage(
  message,
  rule,
  options = {}
) {
  const result =
    await validateMessage(
      message,
      rule
    );

  if (result.allowed) {
    return {
      action: "allowed",
      result,
    };
  }

  if (result.serious) {

    await deleteAndModerate(
      message,
      result.reason,
      true
    );

    return {
      action: "serious",
      result,
    };
  }

  // IMPORTANT:
  // Off-topic/invalid content is deleted ONLY.
  // No warning.
  // No violation count.
  // No moderation log.
  await deleteOnly(
    message,
    result.reason
  );

  return {
    action: "deleted",
    result,
  };
}

// ============================================================
// STARTUP MESSAGE CLEANUP
// ============================================================

async function cleanupChannelOnStartup(
  channel,
  rule
) {
  if (!channel?.isTextBased()) {
    return;
  }

  if (
    startupCleanupDone.has(channel.id)
  ) {
    return;
  }

  startupCleanupDone.add(
    channel.id
  );

  console.log(
    `🧹 Cleaning old messages in #${channel.name}...`
  );

  try {
    let before = null;
    let checked = 0;
    let deleted = 0;

    const maximum =
      STARTUP_DEEP_CLEANUP
        ? Math.max(
            STARTUP_CLEANUP_LIMIT,
            100
          )
        : STARTUP_CLEANUP_LIMIT;

    while (checked < maximum) {

      const remaining =
        Math.min(
          100,
          maximum - checked
        );

      const options = {
        limit: remaining,
      };

      if (before) {
        options.before = before;
      }

      const batch =
        await channel.messages.fetch(
          options
        );

      if (!batch.size) {
        break;
      }

      const messages =
        [...batch.values()]
          .sort(
            (a, b) =>
              a.createdTimestamp -
              b.createdTimestamp
          );

      for (const message of messages) {

        checked++;

        // Never moderate our own bot messages.
        if (message.author.bot) {
          continue;
        }

        const result =
          await processMessage(
            message,
            rule,
            {
              startup: true,
            }
          );

        if (
          result.action === "deleted"
        ) {
          deleted++;
        }

        // Avoid hammering OpenAI/Discord.
        await sleep(350);

        if (checked >= maximum) {
          break;
        }
      }

      before =
        messages[0]?.id || null;

      if (
        batch.size < remaining
      ) {
        break;
      }

      if (!STARTUP_DEEP_CLEANUP) {
        break;
      }
    }

    console.log(
      `🧹 Startup cleanup complete in #${channel.name}: checked ${checked}, deleted ${deleted}.`
    );

  } catch (error) {

    console.error(
      `❌ Startup cleanup failed in #${channel.name}:`,
      error.message
    );
  }
}

// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );
}

// ============================================================
// KEEP STICKY AT BOTTOM
// ============================================================

async function refreshStickyAfterMessage(
  channel,
  rule
) {
  // Small delay lets Discord finish the
  // member message deletion/send sequence.
  await sleep(250);

  await ensureSticky(
    channel,
    rule
  );
}

// ============================================================
// MESSAGE CREATE
// ============================================================

client.on(
  "messageCreate",
  async (message) => {

    try {

      if (message.author.bot) {
        return;
      }

      if (!message.guild) {
        return;
      }

      const rule =
        CHANNEL_RULES[
          message.channel.id
        ];

      if (!rule) {
        return;
      }

      const result =
        await processMessage(
          message,
          rule
        );

      // Allowed content:
      // move sticky to bottom.
      if (
        result.action === "allowed"
      ) {
        await refreshStickyAfterMessage(
          message.channel,
          rule
        );

        return;
      }

      // Deleted/serious content:
      // also put sticky back at bottom.
      await refreshStickyAfterMessage(
        message.channel,
        rule
      );

    } catch (error) {

      console.error(
        "❌ messageCreate error:",
        error
      );
    }
  }
);

// ============================================================
// STICKY REACTION PROTECTION
// ============================================================

client.on(
  "messageReactionAdd",
  async (reaction, user) => {

    try {

      if (user.bot) {
        return;
      }

      const message =
        reaction.message;

      if (
        !isStickyMessage(message)
      ) {
        // Normal member posts:
        // reactions remain allowed.
        return;
      }

      await reaction.users.remove(
        user.id
      );

      console.log(
        `🚫 Removed ${user.tag}'s reaction from sticky in #${message.channel.name}`
      );

    } catch (error) {

      console.error(
        "❌ Sticky reaction protection error:",
        error.message
      );
    }
  }
);

// ============================================================
// INITIALIZE CHANNEL
// ============================================================

async function initializeChannel(
  channelId,
  rule
) {
  try {

    const channel =
      await client.channels.fetch(
        channelId
      );

    if (!channel?.isTextBased()) {
      console.warn(
        `⚠️ ${channelId} is not a text channel.`
      );

      return;
    }

    // First remove duplicate/old sticky.
    await removeAllStickies(
      channel
    );

    // Clean old messages.
    await cleanupChannelOnStartup(
      channel,
      rule
    );

    // Create fresh sticky LAST.
    await ensureSticky(
      channel,
      rule
    );

  } catch (error) {

    console.error(
      `❌ Channel initialization failed for ${channelId}:`,
      error.message
    );
  }
}

// ============================================================
// INITIALIZE ALL STICKIES + CLEANUP
// ============================================================

async function initializeChannels() {

  console.log(
    "🚀 Initializing LAMPOON channels..."
  );

  for (
    const [
      channelId,
      rule
    ]
    of Object.entries(
      CHANNEL_RULES
    )
  ) {

    await initializeChannel(
      channelId,
      rule
    );

    // Small delay between channels.
    await sleep(500);
  }

  console.log(
    "✅ Channel initialization complete."
  );
}

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [

  new SlashCommandBuilder()
    .setName("sticky-refresh")
    .setDescription(
      "Move the channel sticky to the bottom."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("sticky-remove")
    .setDescription(
      "Remove the sticky from the current channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("sticky-list")
    .setDescription(
      "Show all configured sticky channels."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("sticky-setup")
    .setDescription(
      "Create a fresh sticky in the current channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("cleanup")
    .setDescription(
      "Clean recent messages in the current configured channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

].map((command) =>
  command.toJSON()
);

// ============================================================
// REGISTER COMMANDS
// ============================================================

async function registerCommands() {

  try {

    const rest =
      new REST({
        version: "10",
      }).setToken(
        TOKEN
      );

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

// ============================================================
// INTERACTIONS
// ============================================================

client.on(
  "interactionCreate",
  async (interaction) => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    try {

      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return interaction.reply({
          content:
            "❌ You need **Manage Messages** permission.",
          ephemeral: true,
        });
      }

      const rule =
        CHANNEL_RULES[
          interaction.channelId
        ];

      // ======================================================
      // STICKY REFRESH
      // ======================================================

      if (
        interaction.commandName ===
        "sticky-refresh"
      ) {

        if (!rule) {
          return interaction.reply({
            content:
              "❌ This channel has no configured sticky.",
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
          "✅ Sticky moved to the bottom."
        );
      }

      // ======================================================
      // STICKY SETUP
      // ======================================================

      if (
        interaction.commandName ===
        "sticky-setup"
      ) {

        if (!rule) {
          return interaction.reply({
            content:
              "❌ This channel has no configured sticky.",
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
          "✅ Sticky created and placed at the bottom."
        );
      }

      // ======================================================
      // STICKY REMOVE
      // ======================================================

      if (
        interaction.commandName ===
        "sticky-remove"
      ) {

        await interaction.deferReply({
          ephemeral: true,
        });

        const removed =
          await removeAllStickies(
            interaction.channel
          );

        return interaction.editReply(
          removed
            ? `✅ Removed ${removed} sticky message(s).`
            : "ℹ️ No sticky was found."
        );
      }

      // ======================================================
      // STICKY LIST
      // ======================================================

      if (
        interaction.commandName ===
        "sticky-list"
      ) {

        const lines =
          Object.entries(
            CHANNEL_RULES
          ).map(
            ([channelId, channelRule]) =>
              `• ${AVISALA} **${channelRule.name}** — <#${channelId}>`
          );

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

      // ======================================================
      // MANUAL CLEANUP
      // ======================================================

      if (
        interaction.commandName ===
        "cleanup"
      ) {

        if (!rule) {
          return interaction.reply({
            content:
              "❌ This channel has no configured moderation rule.",
            ephemeral: true,
          });
        }

        await interaction.deferReply({
          ephemeral: true,
        });

        // Allow manual cleanup to run again.
        startupCleanupDone.delete(
          interaction.channelId
        );

        await cleanupChannelOnStartup(
          interaction.channel,
          rule
        );

        await ensureSticky(
          interaction.channel,
          rule
        );

        return interaction.editReply(
          "✅ Recent channel cleanup completed. Off-topic content was deleted without moderation warnings."
        );
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

        await interaction
          .editReply(
            "❌ Something went wrong."
          )
          .catch(() => {});

      } else {

        await interaction
          .reply({
            content:
              "❌ Something went wrong.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  }
);

// ============================================================
// READY
// ============================================================

client.once(
  "clientReady",
  async () => {

    console.log(
      "========================================"
    );

    console.log(
      `🤖 Logged in as ${client.user.tag}`
    );

    console.log(
      `🏠 Connected to ${client.guilds.cache.size} guild(s)`
    );

    console.log(
      `🧠 OpenAI model: ${
        OPENAI_VISION_MODEL || "NOT CONFIGURED"
      }`
    );

    console.log(
      "🎭 LAMPOON Reminder Bot is online."
    );

    console.log(
      "========================================"
    );

    await registerCommands();

    await initializeChannels();
  }
);

// ============================================================
// DISCORD ERRORS
// ============================================================

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

// ============================================================
// PROCESS ERRORS
// ============================================================

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

// ============================================================
// LOGIN
// ============================================================

client
  .login(TOKEN)
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
