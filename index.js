// ==========================================
// LAMPOON REMINDER BOT
// Discord.js v14
// Render + OpenAI Vision
// ==========================================

require("dotenv").config();

const http = require("http");

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

const OpenAI = require("openai");

// ==========================================
// ENVIRONMENT
// ==========================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LAMPOON_ICON_URL = process.env.LAMPOON_ICON_URL || null;
const MOD_LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || null;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || "gpt-5.6-luna";

const MODERATION_TIMEOUT_MINUTES =
  Number(process.env.MODERATION_TIMEOUT_MINUTES) || 10;

const REPEATED_VIOLATION_TIMEOUT_MINUTES =
  Number(process.env.REPEATED_VIOLATION_TIMEOUT_MINUTES) || 30;

const SERIOUS_VIOLATION_TIMEOUT_MINUTES =
  Number(process.env.SERIOUS_VIOLATION_TIMEOUT_MINUTES) || 60;


// ==========================================
// VALIDATE ENVIRONMENT
// ==========================================

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID is missing.");
  process.exit(1);
}


// ==========================================
// RENDER HEALTH CHECK
// ==========================================

const PORT = Number(process.env.PORT) || 10000;

const server = http.createServer((req, res) => {

  if (req.url === "/health") {

    res.writeHead(200, {
      "Content-Type": "text/plain",
    });

    return res.end("OK");
  }

  res.writeHead(200, {
    "Content-Type": "text/plain",
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

const STICKY_MARKER = "READ CHANNEL'S TOPIC !";

const AVISALA =
  "<a:Avisala:1542448826265243660>";


// ==========================================
// STICKY DISPLAY NAMES
// ==========================================

const STICKY_NAMES = {

  profile:
    `${AVISALA} PROFILE SHOWCASE`,

  skin:
    `${AVISALA} SKIN SHOWCASE`,

  hero:
    `${AVISALA} HERO HIGHLIGHT`,

  meme:
    `${AVISALA} MEME`,

  code:
    `${AVISALA} EVENT CODE SHARE`,

  fanart:
    `${AVISALA} FAN ART`,

  build:
    `${AVISALA} BUILD TIPS GUIDE`,

};


// ==========================================
// CHANNEL RULES
// ==========================================
// REPLACE THESE PLACEHOLDERS WITH REAL IDs
// ==========================================

const CHANNEL_RULES = {

  // ----------------------------------------
  // COMMUNITY PROFILE
  // ----------------------------------------

  "1544771901308796929": {

    type: "profile",

    name: "PROFILE SHOWCASE",

    description:
      "Honor of Kings profile screenshots and videos only. Skin screenshots, gameplay screenshots, random photos and unrelated content are not allowed.",

  },


  // ----------------------------------------
  // LAMPOON PROFILE
  // ----------------------------------------

  "1544183278779764742": {

    type: "profile",

    name: "PROFILE SHOWCASE",

    description:
      "Honor of Kings profile screenshots and videos only. Skin screenshots, gameplay screenshots, random photos and unrelated content are not allowed.",

  },


  // ----------------------------------------
  // COMMUNITY SKIN
  // ----------------------------------------

  "1544771836175196204": {

    type: "skin",

    name: "SKIN SHOWCASE",

    description:
      "Honor of Kings skin showcases, previews, reveals, collections, animations, openings and skin-related media only. Profile screenshots, gameplay and unrelated content are not allowed.",

  },


  // ----------------------------------------
  // LAMPOON SKIN
  // ----------------------------------------

  "1544183056867393599": {

    type: "skin",

    name: "SKIN SHOWCASE",

    description:
      "Honor of Kings skin showcases, previews, reveals, collections, animations, openings and skin-related media only. Profile screenshots, gameplay and unrelated content are not allowed.",

  },


  // ----------------------------------------
  // COMMUNITY HERO
  // ----------------------------------------

  "1544771692025483315": {

    type: "hero",

    name: "HERO HIGHLIGHT",

    description:
      "Honor of Kings gameplay and hero highlight videos only, including combat, skills, combos, kills, outplays, escapes, team fights, map plays and other gameplay highlights.",

  },


  // ----------------------------------------
  // LAMPOON HERO
  // ----------------------------------------

  "1544181729097687120": {

    type: "hero",

    name: "HERO HIGHLIGHT",

    description:
      "Honor of Kings gameplay and hero highlight videos only, including combat, skills, combos, kills, outplays, escapes, team fights, map plays and other gameplay highlights.",

  },


  // ----------------------------------------
  // COMMUNITY MEME
  // ----------------------------------------

  "1541020560929198090": {

    type: "meme",

    name: "MEME",

    description:
      "Funny Honor of Kings or community-related memes only. Harassment, hateful content, sexual/explicit content, threats, doxxing and other prohibited content are not allowed.",

  },


  // ----------------------------------------
  // LAMPOON MEME
  // ----------------------------------------

  "1543552879942434837": {

    type: "meme",

    name: "MEME",

    description:
      "Funny Honor of Kings or community-related memes only. Harassment, hateful content, sexual/explicit content, threats, doxxing and other prohibited content are not allowed.",

  },


  // ----------------------------------------
  // COMMUNITY EVENT CODE
  // ----------------------------------------

  "1541019893552644187": {

    type: "code",

    name: "EVENT CODE SHARE",

    description:
      "Honor of Kings event codes and screenshots containing event codes only. Captions and descriptions are allowed when related to the code.",

  },


  // ----------------------------------------
  // LAMPOON EVENT CODE
  // ----------------------------------------

  "1544182436353810432": {

    type: "code",

    name: "EVENT CODE SHARE",

    description:
      "Honor of Kings event codes and screenshots containing event codes only. Captions and descriptions are allowed when related to the code.",

  },


  // ----------------------------------------
  // FAN ART
  // ----------------------------------------

  "1541020395426283521": {

    type: "fanart",

    name: "FAN ART",

    description:
      "Honor of Kings fan-created artwork only. Pencil, line art, digital art and traditional art are allowed. AI-generated art, ordinary screenshots, official promotional art, memes and unrelated images are not allowed.",

  },


  // ----------------------------------------
  // BUILD TIPS
  // ----------------------------------------

  "1541019792394158080": {

    type: "build",

    name: "BUILD TIPS GUIDE",

    description:
      "Honor of Kings build tips, item recommendations, Arcana, hero builds, match analysis and educational gameplay guides only. Casual chatting and unrelated content are not allowed.",

  },

};


// ==========================================
// STICKY MESSAGE CACHE
// ==========================================

const stickyMessages = new Map();


// ==========================================
// VIOLATION TRACKER
// ==========================================

const violationCounts = new Map();


// ==========================================
// BASIC MEDIA HELPERS
// ==========================================

function isImage(attachment) {

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
// POSSIBLE EVENT CODE
// ==========================================

function containsPossibleCode(text) {

  if (!text) return false;

  const clean =
    text.trim();

  if (!clean) return false;

  // Common code formats
  const patterns = [

    /^[A-Z0-9]{4,32}$/i,

    /^[A-Z0-9]{3,12}[-_][A-Z0-9]{2,12}$/i,

    /^[A-Z0-9]{2,12}[-_][A-Z0-9]{2,12}[-_][A-Z0-9]{2,12}$/i,

    /^\d{4,32}$/,

  ];

  return patterns.some(
    pattern => pattern.test(clean)
  );
}


// ==========================================
// CASUAL CHAT DETECTION
// ==========================================

function isCasualChat(text) {

  if (!text) return false;

  const normalized =
    text
      .trim()
      .toLowerCase()
      .replace(/[!?.,]+$/g, "");

  const casual = [

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

  ];

  return casual.includes(normalized);
}


// ==========================================
// OPENAI IMAGE CLASSIFIER
// ==========================================

async function classifyImage(imageUrl, channelType) {

  if (!openai) {

    console.warn(
      "⚠️ OPENAI_API_KEY not configured. Image AI classification unavailable."
    );

    return {
      allowed: false,
      reason: "AI classification unavailable.",
    };
  }

  let instruction = "";

  // ----------------------------------------
  // PROFILE
  // ----------------------------------------

  if (channelType === "profile") {

    instruction = `
Determine whether this image is specifically an Honor of Kings PROFILE SCREEN.

ALLOW only if the image clearly shows an Honor of Kings player profile,
profile page, player information/profile interface, profile statistics,
profile card or similar profile screen.

REJECT:
- Honor of Kings skin showcase
- skin artwork
- gameplay
- battle screenshot
- hero screen
- shop screen
- random photo
- unrelated image
- meme
- fan art
- ambiguous image

Return JSON only:
{"allowed":true/false,"reason":"short reason"}
`;

  }


  // ----------------------------------------
  // SKIN
  // ----------------------------------------

  else if (channelType === "skin") {

    instruction = `
Determine whether this image is an Honor of Kings SKIN SHOWCASE.

ALLOW:
- Honor of Kings skin showcase
- skin preview
- skin collection
- skin card
- skin artwork when clearly presented as an in-game skin
- skin reveal
- skin animation preview
- obtaining/unlocking a skin
- skin display

REJECT:
- player profile
- gameplay
- match screenshot
- random photo
- unrelated image
- fan art unrelated to an in-game skin

Return JSON only:
{"allowed":true/false,"reason":"short reason"}
`;

  }


  // ----------------------------------------
  // MEME
  // ----------------------------------------

  else if (channelType === "meme") {

    instruction = `
Determine whether this image is a funny Honor of Kings or community-related MEME.

ALLOW:
- HOK meme
- gaming meme
- HOK reaction meme
- funny screenshot
- parody/edit
- funny HOK GIF/image
- community-related humor

REJECT:
- unrelated random photo
- serious unrelated content
- explicit sexual content
- severe harassment
- hateful content targeting protected classes
- threats
- doxxing/private information
- self-harm encouragement
- malicious spam/advertising

Protected-class words alone are NOT enough to reject an image.
Context and targeting matter.

Return JSON only:
{"allowed":true/false,"reason":"short reason"}
`;

  }


  // ----------------------------------------
  // FAN ART
  // ----------------------------------------

  else if (channelType === "fanart") {

    instruction = `
Determine whether this image is HUMAN-CREATED FAN ART related to Honor of Kings.

ALLOW:
- HOK fan-created artwork
- hero fan art
- skin fan art
- character drawings
- pencil drawings
- line art
- digital artwork
- traditional artwork

REJECT:
- AI-generated artwork
- ordinary in-game screenshot
- official promotional art
- official game artwork
- meme
- random photo
- unrelated art
- unrelated image

If it appears AI-generated or you cannot reasonably determine that it is
human-created fan art, reject it.

Return JSON only:
{"allowed":true/false,"reason":"short reason"}
`;

  }


  // ========================================
  // CALL OPENAI
  // ========================================

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


    // Extract JSON
    const match =
      output.match(/\{[\s\S]*\}/);

    if (!match) {

      return {
        allowed: false,
        reason: "AI returned an invalid classification.",
      };

    }


    const result =
      JSON.parse(match[0]);


    return {

      allowed:
        result.allowed === true,

      reason:
        result.reason ||
        "No reason provided.",

    };

  } catch (error) {

    console.error(
      "❌ OpenAI image classification error:",
      error.message
    );

    return {

      allowed: false,

      reason:
        "Image classification failed.",

    };

  }

}


// ==========================================
// CLASSIFY ALL IMAGES
// ==========================================

async function classifyMessageImages(
  message,
  channelType
) {

  const images =
    getImages(message);

  if (images.length === 0) {

    return {

      allowed: false,

      reason: "No image found.",

    };

  }


  for (const image of images) {

    const result =
      await classifyImage(
        image.url,
        channelType
      );

    if (result.allowed) {

      return result;

    }

  }


  return {

    allowed: false,

    reason:
      "The image does not match this channel's content rules.",

  };

}


// ==========================================
// MESSAGE VALIDATION
// ==========================================

async function validateMessage(
  message,
  rule
) {

  // ========================================
  // REPLIES ARE NEVER ALLOWED
  // ========================================

  if (message.reference) {

    return {

      allowed: false,

      reason:
        "Replies to another member's post are not allowed in this channel.",

      serious: false,

    };

  }


  // ========================================
  // PROFILE
  // ========================================

  if (rule.type === "profile") {

    const images =
      getImages(message);

    const videos =
      getVideos(message);

    if (
      images.length === 0 &&
      videos.length === 0
    ) {

      return {

        allowed: false,

        reason:
          "Profile Showcase requires an Honor of Kings profile image or video.",

        serious: false,

      };

    }


    // Image AI check
    if (images.length > 0) {

      const result =
        await classifyMessageImages(
          message,
          "profile"
        );

      if (!result.allowed) {

        return {

          allowed: false,

          reason: result.reason,

          serious: false,

        };

      }

    }


    // Videos are structurally accepted.
    // Semantic video checking requires frame extraction.

    return {
      allowed: true,
    };

  }


  // ========================================
  // SKIN
  // ========================================

  if (rule.type === "skin") {

    const images =
      getImages(message);

    const videos =
      getVideos(message);

    if (
      images.length === 0 &&
      videos.length === 0
    ) {

      return {

        allowed: false,

        reason:
          "Skin Showcase requires Honor of Kings skin media.",

        serious: false,

      };

    }


    if (images.length > 0) {

      const result =
        await classifyMessageImages(
          message,
          "skin"
        );

      if (!result.allowed) {

        return {

          allowed: false,

          reason: result.reason,

          serious: false,

        };

      }

    }


    return {
      allowed: true,
    };

  }


  // ========================================
  // HERO HIGHLIGHT
  // ========================================

  if (rule.type === "hero") {

    const videos =
      getVideos(message);

    if (videos.length === 0) {

      return {

        allowed: false,

        reason:
          "Hero Highlight requires an Honor of Kings gameplay/highlight video.",

        serious: false,

      };

    }

    return {
      allowed: true,
    };

  }


  // ========================================
  // MEME
  // ========================================

  if (rule.type === "meme") {

    const images =
      getImages(message);

    const videos =
      getVideos(message);

    if (
      images.length === 0 &&
      videos.length === 0
    ) {

      return {

        allowed: false,

        reason:
          "Meme channel requires a meme image or video.",

        serious: false,

      };

    }


    if (images.length > 0) {

      const result =
        await classifyMessageImages(
          message,
          "meme"
        );

      if (!result.allowed) {

        return {

          allowed: false,

          reason: result.reason,

          serious: false,

        };

      }

    }


    return {
      allowed: true,
    };

  }


  // ========================================
  // EVENT CODE
  // ========================================

  if (rule.type === "code") {

    const text =
      message.content.trim();

    const images =
      getImages(message);

    const videos =
      getVideos(message);


    // Text code
    if (containsPossibleCode(text)) {

      return {
        allowed: true,
      };

    }


    // Code screenshot
    if (images.length > 0) {

      return {
        allowed: true,
      };

    }


    // Video is not accepted
    if (videos.length > 0) {

      return {

        allowed: false,

        reason:
          "Event Code Share does not allow unrelated videos.",

        serious: false,

      };

    }


    return {

      allowed: false,

      reason:
        "Only event codes or screenshots containing event codes are allowed.",

      serious: false,

    };

  }


  // ========================================
  // FAN ART
  // ========================================

  if (rule.type === "fanart") {

    const images =
      getImages(message);

    if (images.length === 0) {

      return {

        allowed: false,

        reason:
          "Fan Art requires a human-created Honor of Kings artwork image.",

        serious: false,

      };

    }


    const result =
      await classifyMessageImages(
        message,
        "fanart"
      );


    if (!result.allowed) {

      return {

        allowed: false,

        reason: result.reason,

        serious: false,

      };

    }


    return {
      allowed: true,
    };

  }


  // ========================================
  // BUILD TIPS
  // ========================================

  if (rule.type === "build") {

    const images =
      getImages(message);

    const videos =
      getVideos(message);

    const text =
      message.content.trim();


    // Media is allowed.
    // Content should still be related to HOK/build education.
    if (
      images.length > 0 ||
      videos.length > 0
    ) {

      return {
        allowed: true,
      };

    }


    // Text guide
    if (text.length >= 20) {

      const keywords = [

        "build",
        "arcana",
        "item",
        "items",
        "equipment",
        "hero",
        "lane",
        "gank",
        "rotation",
        "roam",
        "roaming",
        "team fight",
        "teamfight",
        "objective",
        "farming",
        "farm",
        "skill",
        "combo",
        "positioning",
        "damage",
        "defense",
        "defence",
        "attack",
        "match",
        "hok",
        "honor of kings",

      ];


      const lower =
        text.toLowerCase();

      const hasKeyword =
        keywords.some(
          keyword =>
            lower.includes(keyword)
        );


      if (
        hasKeyword &&
        !isCasualChat(text)
      ) {

        return {
          allowed: true,
        };

      }

    }


    return {

      allowed: false,

      reason:
        "Only useful Honor of Kings build tips, guides, recommendations or educational content are allowed.",

      serious: false,

    };

  }


  // ========================================
  // UNKNOWN CHANNEL
  // ========================================

  return {

    allowed: true,

  };

}


// ==========================================
// STAFF CHECK
// ==========================================

function isStaff(member) {

  if (!member) return false;

  return member.permissions.has(
    PermissionsBitField.Flags.ManageMessages
  );

}


// ==========================================
// MODERATION LOG
// ==========================================

async function sendModerationLog({

  member,
  channel,
  action,
  duration,
  reason,

}) {

  if (!MOD_LOG_CHANNEL_ID) return;

  try {

    const logChannel =
      await client.channels.fetch(
        MOD_LOG_CHANNEL_ID
      );

    if (
      !logChannel ||
      !logChannel.isTextBased()
    ) {
      return;
    }


    const embed =
      new EmbedBuilder()

        .setColor(GOLD)

        .setTitle("Moderation Action")

        .addFields(

          {
            name: "Member",
            value:
              `${member.user.tag}\n<@${member.id}>`,
            inline: true,
          },

          {
            name: "Channel",
            value:
              `<#${channel.id}>`,
            inline: true,
          },

          {
            name: "Action",
            value:
              action,
            inline: true,
          },

          {
            name: "Duration",
            value:
              duration || "None",
            inline: true,
          },

          {
            name: "Reason",
            value:
              reason || "No reason provided.",
            inline: false,
          }

        )

        .setTimestamp();


    await logChannel.send({
      embeds: [embed],
    });

  } catch (error) {

    console.error(
      "❌ Moderation log error:",
      error.message
    );

  }

}


// ==========================================
// REGISTER VIOLATION
// ==========================================

async function registerViolation(
  message,
  reason,
  serious = false
) {

  const key =
    `${message.guild.id}:${message.author.id}`;

  const current =
    violationCounts.get(key) || 0;

  const count =
    current + 1;

  violationCounts.set(
    key,
    count
  );


  // ========================================
  // SERIOUS VIOLATION
  // ========================================

  if (serious) {

    const minutes =
      SERIOUS_VIOLATION_TIMEOUT_MINUTES;

    await timeoutMember(
      message.member,
      minutes,
      reason,
      message.channel
    );

    return;
  }


  // ========================================
  // REPEATED VIOLATION
  // ========================================

  if (count >= 3) {

    const minutes =
      REPEATED_VIOLATION_TIMEOUT_MINUTES;

    await timeoutMember(
      message.member,
      minutes,
      `Repeated channel violations (${count} violations).`,
      message.channel
    );

    // Reset after timeout
    violationCounts.delete(key);

    return;
  }


  // ========================================
  // NORMAL WARNING
  // ========================================

  await sendModerationLog({

    member: message.member,

    channel: message.channel,

    action: "Warning",

    duration: "None",

    reason,

  });

}


// ==========================================
// TIMEOUT MEMBER
// ==========================================

async function timeoutMember(
  member,
  minutes,
  reason,
  channel
) {

  if (!member) return;


  // Staff bypass
  if (isStaff(member)) {

    console.log(
      `⚠️ Staff member ${member.user.tag} was not timed out.`
    );

    return;

  }


  // Check bot permissions
  const botMember =
    member.guild.members.me;

  if (!botMember) return;


  if (
    !botMember.permissions.has(
      PermissionsBitField.Flags.ModerateMembers
    )
  ) {

    console.error(
      "❌ Bot does not have Moderate Members permission."
    );

    return;

  }


  // Role hierarchy
  if (
    member.roles.highest.position >=
    botMember.roles.highest.position
  ) {

    console.error(
      `❌ Cannot timeout ${member.user.tag}: role hierarchy.`
    );

    return;

  }


  try {

    await member.timeout(

      minutes * 60 * 1000,

      reason

    );


    await sendModerationLog({

      member,

      channel,

      action: "Timeout",

      duration:
        `${minutes} minutes`,

      reason,

    });


    console.log(
      `⏱️ Timed out ${member.user.tag} for ${minutes} minutes.`
    );

  } catch (error) {

    console.error(
      `❌ Failed to timeout ${member.user.tag}:`,
      error.message
    );

  }

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

      `🚫 **Unrelated content will be removed.**\n\n` +

      `🚫 **Do not react to messages in this channel.**`

    );

}


// ==========================================
// FIND EXISTING STICKY
// ==========================================

async function findExistingSticky(channel) {

  try {

    const messages =
      await channel.messages.fetch({
        limit: 100,
      });


    const stickies =
      messages.filter(message =>

        message.author.id ===
          client.user.id &&

        message.embeds.length > 0 &&

        message.embeds[0].title ===
          STICKY_MARKER

      );


    if (stickies.size === 0) {

      return null;

    }


    // Sort oldest -> newest
    const sorted =
      [...stickies.values()]
        .sort(
          (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp
        );


    // Keep the oldest existing sticky
    const mainSticky =
      sorted[0];


    // Delete all duplicates
    for (
      let i = 1;
      i < sorted.length;
      i++
    ) {

      try {

        await sorted[i].delete();

        console.log(
          `🗑️ Removed duplicate sticky from #${channel.name}`
        );

      } catch (error) {

        console.error(
          `Failed to remove duplicate sticky in #${channel.name}:`,
          error.message
        );

      }

    }


    return mainSticky;

  } catch (error) {

    console.error(
      `❌ Failed to search sticky in #${channel.name}:`,
      error.message
    );

    return null;

  }

}


// ==========================================
// ENSURE ONE STICKY
// ==========================================

async function ensureSticky(
  channel,
  rule
) {

  if (!channel || !rule) {
    return null;
  }


  try {

    let sticky =
      stickyMessages.get(
        channel.id
      );


    // ======================================
    // CHECK CACHE
    // ======================================

    if (sticky) {

      try {

        sticky =
          await channel.messages.fetch(
            sticky.id
          );

      } catch {

        sticky = null;

        stickyMessages.delete(
          channel.id
        );

      }

    }


    // ======================================
    // SEARCH CHANNEL
    // ======================================

    if (!sticky) {

      sticky =
        await findExistingSticky(
          channel
        );

    }


    const embed =
      createStickyEmbed(rule);


    // ======================================
    // EDIT EXISTING STICKY
    // ======================================

    if (sticky) {

      await sticky.edit({

        content: null,

        embeds: [embed],

      });


      stickyMessages.set(
        channel.id,
        sticky
      );


      console.log(
        `📌 Sticky updated: #${channel.name}`
      );


      return sticky;

    }


    // ======================================
    // CREATE ONLY IF NONE EXISTS
    // ======================================

    const newSticky =
      await channel.send({

        embeds: [embed],

      });


    stickyMessages.set(
      channel.id,
      newSticky
    );


    console.log(
      `📌 Sticky created: #${channel.name}`
    );


    return newSticky;

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

async function refreshSticky(channel) {

  if (!channel) return;

  const rule =
    CHANNEL_RULES[channel.id];

  if (!rule) return;

  await ensureSticky(
    channel,
    rule
  );

}


// ==========================================
// INITIALIZE STICKIES
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


      if (
        !channel ||
        !channel.isTextBased()
      ) {

        continue;

      }


      await ensureSticky(
        channel,
        rule
      );


    } catch (error) {

      console.error(
        `❌ Failed to initialize ${channelId}:`,
        error.message
      );

    }

  }


  console.log(
    "✅ Sticky initialization complete."
  );

}


// ==========================================
// DELETE MESSAGE
// ==========================================

async function removeMessage(
  message,
  reason
) {

  try {

    await message.delete();

    console.log(
      `🗑️ Removed message from ${message.author.tag}: ${reason}`
    );

  } catch (error) {

    console.error(
      "❌ Failed to delete message:",
      error.message
    );

  }


  await registerViolation(
    message,
    reason,
    false
  );


  // Re-ensure sticky
  await refreshSticky(
    message.channel
  );

}


// ==========================================
// MESSAGE CREATE
// ==========================================

client.on(
  "messageCreate",
  async message => {

    try {

      // Ignore bots
      if (message.author.bot) {
        return;
      }


      // Ignore DMs
      if (!message.guild) {
        return;
      }


      const rule =
        CHANNEL_RULES[
          message.channel.id
        ];


      // Not a moderated channel
      if (!rule) {
        return;
      }


      // ====================================
      // STAFF BYPASS
      // ====================================

      if (
        isStaff(
          message.member
        )
      ) {

        return;

      }


      // ====================================
      // VALIDATE
      // ====================================

      const result =
        await validateMessage(
          message,
          rule
        );


      if (result.allowed) {

        // Keep ONE sticky only.
        await refreshSticky(
          message.channel
        );

        return;

      }


      // ====================================
      // INVALID CONTENT
      // ====================================

      await removeMessage(
        message,
        result.reason ||
          "Content does not follow this channel's rules."
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
// REACTION BLOCKER
// ==========================================

client.on(
  "messageReactionAdd",
  async (
    reaction,
    user
  ) => {

    try {

      if (user.bot) {
        return;
      }


      const channel =
        reaction.message.channel;


      const rule =
        CHANNEL_RULES[channel.id];


      if (!rule) {
        return;
      }


      // Staff can react
      const guild =
        channel.guild;

      const member =
        await guild.members
          .fetch(user.id)
          .catch(() => null);


      if (
        member &&
        isStaff(member)
      ) {

        return;

      }


      // Remove reaction
      await reaction.users.remove(
        user.id
      );


      console.log(
        `🚫 Removed reaction from ${user.tag} in #${channel.name}`
      );

    } catch (error) {

      console.error(
        "❌ Reaction removal error:",
        error.message
      );

    }

  }
);


// ==========================================
// READY
// ==========================================

client.once(
  "ready",
  async () => {

    console.log(
      `✅ Logged in as ${client.user.tag}`
    );


    console.log(
      `📡 Serving ${client.guilds.cache.size} guild(s)`
    );


    await initializeStickies();


    console.log(
      "🚀 Reminder Bot is fully online."
    );

  }
);


// ==========================================
// SLASH COMMANDS
// ==========================================

const commands = [

  new SlashCommandBuilder()

    .setName("sticky-refresh")

    .setDescription(
      "Refresh the sticky message in this channel."
    ),


  new SlashCommandBuilder()

    .setName("sticky-remove")

    .setDescription(
      "Remove sticky messages from this channel."
    ),


  new SlashCommandBuilder()

    .setName("sticky-list")

    .setDescription(
      "Show configured sticky channels."
    ),


  new SlashCommandBuilder()

    .setName("sticky-setup")

    .setDescription(
      "Create or repair the sticky message in this channel."
    ),

].map(
  command => command.toJSON()
);


// ==========================================
// REGISTER COMMANDS
// ==========================================

async function registerCommands() {

  try {

    const rest =
      new REST({
        version: "10",
      }).setToken(TOKEN);


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
      "❌ Failed to register slash commands:",
      error.message
    );

  }

}


// ==========================================
// INTERACTION CREATE
// ==========================================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }


    // ======================================
    // STICKY REFRESH
    // ======================================

    if (
      interaction.commandName ===
      "sticky-refresh"
    ) {

      if (
        !interaction.memberPermissions.has(
          PermissionsBitField.Flags.ManageMessages
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
          interaction.channel.id
        ];


      if (!rule) {

        return interaction.reply({

          content:
            "❌ This channel is not configured for Reminder Bot.",

          ephemeral: true,

        });

      }


      await interaction.deferReply({
        ephemeral: true,
      });


      await refreshSticky(
        interaction.channel
      );


      await interaction.editReply(
        "✅ Sticky message refreshed. Only one sticky is kept."
      );

      return;

    }


    // ======================================
    // STICKY SETUP
    // ======================================

    if (
      interaction.commandName ===
      "sticky-setup"
    ) {

      if (
        !interaction.memberPermissions.has(
          PermissionsBitField.Flags.ManageMessages
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
          interaction.channel.id
        ];


      if (!rule) {

        return interaction.reply({

          content:
            "❌ This channel is not configured for Reminder Bot.",

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


      await interaction.editReply(
        "✅ Sticky setup complete. Duplicate stickies were removed."
      );

      return;

    }


    // ======================================
    // STICKY REMOVE
    // ======================================

    if (
      interaction.commandName ===
      "sticky-remove"
    ) {

      if (
        !interaction.memberPermissions.has(
          PermissionsBitField.Flags.ManageMessages
        )
      ) {

        return interaction.reply({

          content:
            "❌ You need **Manage Messages** permission.",

          ephemeral: true,

        });

      }


      await interaction.deferReply({
        ephemeral: true,
      });


      try {

        const messages =
          await interaction.channel.messages.fetch({
            limit: 100,
          });


        const stickies =
          messages.filter(message =>

            message.author.id ===
              client.user.id &&

            message.embeds.length > 0 &&

            message.embeds[0].title ===
              STICKY_MARKER

          );


        let removed = 0;


        for (
          const sticky
          of stickies.values()
        ) {

          try {

            await sticky.delete();

            removed++;

          } catch {}

        }


        stickyMessages.delete(
          interaction.channel.id
        );


        await interaction.editReply(
          `✅ Removed ${removed} sticky message(s).`
        );


      } catch (error) {

        await interaction.editReply(
          "❌ Failed to remove sticky messages."
        );

      }

      return;

    }


    // ======================================
    // STICKY LIST
    // ======================================

    if (
      interaction.commandName ===
      "sticky-list"
    ) {

      if (
        !interaction.memberPermissions.has(
          PermissionsBitField.Flags.ManageMessages
        )
      ) {

        return interaction.reply({

          content:
            "❌ You need **Manage Messages** permission.",

          ephemeral: true,

        });

      }


      const entries =
        Object.entries(
          CHANNEL_RULES
        );


      const lines =
        entries.map(
          ([channelId, rule]) => {

            return (
              `${STICKY_NAMES[rule.type] || rule.name} → <#${channelId}>`
            );

          }
        );


      const embed =
        new EmbedBuilder()

          .setColor(GOLD)

          .setTitle(
            `${AVISALA} CONFIGURED STICKY CHANNELS`
          )

          .setDescription(
            lines.join("\n")
          );


      await interaction.reply({

        embeds: [embed],

        ephemeral: true,

      });

      return;

    }

  }
);


// ==========================================
// DISCORD ERRORS
// ==========================================

client.on(
  "error",
  error => {

    console.error(
      "❌ Discord client error:",
      error
    );

  }
);


process.on(
  "unhandledRejection",
  error => {

    console.error(
      "❌ Unhandled promise rejection:",
      error
    );

  }
);


process.on(
  "uncaughtException",
  error => {

    console.error(
      "❌ Uncaught exception:",
      error
    );

  }
);


// ==========================================
// REGISTER + LOGIN
// ==========================================

(async () => {

  await registerCommands();

  await client.login(TOKEN);

})();
