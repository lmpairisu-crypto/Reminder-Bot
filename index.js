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

if (!TOKEN) throw new Error("Missing DISCORD_TOKEN.");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID.");
if (!GUILD_ID) throw new Error("Missing GUILD_ID.");

// ==========================================
// RENDER HEALTH CHECK
// ==========================================

const PORT = Number(process.env.PORT) || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
  });

  res.end(
    req.url === "/health"
      ? "OK"
      : "Reminder Bot is online."
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Health server running on port ${PORT}`);
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

const STICKY_MARKER =
  "READ CHANNEL'S TOPIC !";

const AVISALA =
  "<a:Avisala:1542448826265243660>";

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
// STICKY NAMES
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
// RUNTIME MEMORY
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

  return (
    /\b[A-Z0-9]{4,32}\b/i.test(value) ||
    /\b[A-Z0-9]{2,16}[-_][A-Z0-9]{2,16}\b/i.test(value) ||
    /\b\d{4,32}\b/.test(value)
  );
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
// FIND STICKY
// ==========================================

async function findExistingSticky(channel) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 100,
      });

    const stickies =
      messages.filter(
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

    const sorted =
      [...stickies.values()].sort(
        (a, b) =>
          a.createdTimestamp -
          b.createdTimestamp
      );

    const keeper = sorted[0];

    // Remove duplicate stickies only.
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
// ENSURE STICKY
// ==========================================

async function ensureSticky(channel, rule) {
  try {
    let sticky =
      stickyMessages.get(channel.id) ||
      null;

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

    if (!sticky) {
      sticky =
        await findExistingSticky(channel);
    }

    const embed =
      createStickyEmbed(rule);

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

    const created =
      await channel.send({
        embeds: [embed],
      });

    stickyMessages.set(
      channel.id,
      created
    );

    console.log(
      `📌 Sticky ready in #${channel.name}`
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
// OPENAI IMAGE CLASSIFIER
// ==========================================

async function classifyImage(
  imageUrl,
  channelType
) {
  if (!openai) {
    return {
      allowed: false,
      serious: false,
      reason:
        "AI image classification is unavailable.",
    };
  }

  const instructions = {

    profile: `
Classify this image for an Honor of Kings PROFILE SHOWCASE channel.

ALLOW only clear Honor of Kings profile screens,
player profiles, profile pages, profile statistics,
or profile showcases.

REJECT skins, gameplay, random screenshots,
memes, fan art, unrelated images, and ambiguous images.
`,

    skin: `
Classify this image for an Honor of Kings SKIN SHOWCASE channel.

ALLOW clear Honor of Kings skin showcases, skin previews,
skin collections, skin cards, skin reveals, skin animations,
or in-game skin presentation.

REJECT player profiles, ordinary gameplay, random screenshots,
fan art, memes, unrelated images, and ambiguous images.
`,

    meme: `
Classify this image for an Honor of Kings MEME channel.

ALLOW Honor of Kings memes, funny HOK screenshots,
reaction images, parody, edits, and humorous HOK images.

REJECT unrelated content, explicit sexual content,
severe harassment, hateful targeting of protected classes,
threats, doxxing/private information, self-harm encouragement,
and malicious spam or advertisements.

A protected-class word alone is not enough to reject an image.
`,

    fanart: `
Classify this image for an Honor of Kings FAN ART channel.

ALLOW human-created Honor of Kings fan art, including
pencil, line, digital, and traditional art of HOK heroes or skins.

REJECT AI-generated art, in-game screenshots,
official promotional images, gameplay, memes,
unrelated art, and ambiguous images.

If you cannot confidently determine that it is
human-created Honor of Kings fan art, reject it.
`,
  };

  const instruction = `
${instructions[channelType] || ""}

Return JSON only:

{
  "allowed": true or false,
  "serious": true or false,
  "reason": "short reason"
}
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
      reason: String(
        result.reason ||
          "No reason provided."
      ),
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

  const images =
    getImages(message);

  const videos =
    getVideos(message);

  // ----------------------------------------
  // PROFILE
  // ----------------------------------------

  if (rule.type === "profile") {
    if (
      !images.length &&
      !videos.length
    ) {
      return {
        allowed: false,
        serious: false,
        reason:
          "Text-only conversation is not allowed. A profile image or video is required.",
      };
    }

    if (images.length) {
      return classifyImage(
        images[0].url,
        "profile"
      );
    }

    return {
      allowed: true,
      serious: false,
      reason:
        "Profile video accepted.",
    };
  }

  // ----------------------------------------
  // SKIN
  // ----------------------------------------

  if (rule.type === "skin") {
    if (
      !images.length &&
      !videos.length
    ) {
      return {
        allowed: false,
        serious: false,
        reason:
          "Text-only conversation is not allowed. A skin image or video is required.",
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
      reason:
        "Skin video accepted.",
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
          "Text-only conversation is not allowed. A Hero Highlight video is required.",
      };
    }

    return {
      allowed: true,
      serious: false,
      reason:
        "Hero Highlight video accepted.",
    };
  }

  // ----------------------------------------
  // MEME
  // ----------------------------------------

  if (rule.type === "meme") {
    if (
      !images.length &&
      !videos.length
    ) {
      return {
        allowed: false,
        serious: false,
        reason:
          "Text-only conversation is not allowed. A meme image or video is required.",
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
      reason:
        "Meme video accepted.",
    };
  }

  // ----------------------------------------
  // EVENT CODE
  // ----------------------------------------

  if (rule.type === "code") {
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
        "Normal conversation is not allowed. Send an event code or code screenshot.",
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
          "Text-only conversation is not allowed. A fan art image is required.",
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

    // Media posts are allowed.
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

    // Short normal conversation is removed.
    if (text.length < 20) {
      return {
        allowed: false,
        serious: false,
        reason:
          "Short casual conversation is not allowed. Post a useful build or detailed guide.",
      };
    }

    const hasBuildKeyword =
      /\b(build|arcana|equipment|item|items|talent|spell|emblem|strategy|guide|damage|defense|lane|hero|roam|jungle|clash|farm|mid|marksman|mage|fighter|tank|support)\b/i.test(
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

  return {
    allowed: true,
    serious: false,
    reason: "Allowed.",
  };
}

// ==========================================
// MODERATION LOG
// ==========================================

async function sendModerationLog(
  embed
) {
  if (!MOD_LOG_CHANNEL_ID) return;

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

// ==========================================
// TIMEOUT
// ==========================================

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

// ==========================================
// VIOLATION TRACKING
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
    (violationCounts.get(key) || 0) +
    1;

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
      .setTitle(
        "🚫 CHANNEL VIOLATION"
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
      "❌ Message deletion failed:",
      error.message
    );
  }

  await registerViolation(
    message,
    reason,
    serious
  );

  const rule =
    CHANNEL_RULES[
      message.channel.id
    ];

  if (rule) {
    await ensureSticky(
      message.channel,
      rule
    );
  }
}

// ==========================================
// MESSAGE MODERATION
// ==========================================
//
// IMPORTANT:
// Only NEW messages are processed.
// OLD/EXISTING posts are NOT scanned
// or automatically deleted.
// ==========================================

client.on(
  "messageCreate",
  async (message) => {
    try {
      if (message.author.bot) return;

      if (!message.guild) return;

      const rule =
        CHANNEL_RULES[
          message.channel.id
        ];

      if (!rule) return;

      const result =
        await validateMessage(
          message,
          rule
        );

      if (result.allowed) {
        await ensureSticky(
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
// NORMAL MEMBER POSTS:
// ✅ Reactions allowed.
//
// BOT STICKY:
// ❌ Reactions removed.
//
// ==========================================

client.on(
  "messageReactionAdd",
  async (reaction, user) => {
    try {
      if (user.bot) return;

      const message =
        reaction.message;

      const isSticky =
        message.author?.id ===
          client.user.id &&
        message.embeds?.some(
          (embed) =>
            embed.title ===
            STICKY_MARKER
        );

      // Do NOTHING to normal posts.
      if (!isSticky) return;

      // Only remove reaction from sticky.
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

// ==========================================
// INITIALIZE STICKIES
// ==========================================

async function initializeStickies() {
  console.log(
    "📌 Initializing stickies..."
  );

  for (
    const [channelId, rule]
    of Object.entries(
      CHANNEL_RULES
    )
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
        `❌ Sticky initialization failed for ${channelId}:`,
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
      "Refresh the sticky in the current channel."
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
      "Create or update the sticky in the current channel."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
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

      // --------------------------------------
      // REFRESH
      // --------------------------------------

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
          "✅ Sticky refreshed."
        );
      }

      // --------------------------------------
      // SETUP
      // --------------------------------------

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
          "✅ Sticky created or updated."
        );
      }

      // --------------------------------------
      // REMOVE
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
            "ℹ️ No sticky was found."
          );
        }

        await sticky
          .delete()
          .catch(() => {});

        stickyMessages.delete(
          interaction.channelId
        );

        return interaction.editReply(
          "✅ Sticky removed."
        );
      }

      // --------------------------------------
      // LIST
      // --------------------------------------

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
