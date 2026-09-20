// ======================================================
// REMINDER BOT
// Honor of Kings Community / Lampoon
// ======================================================

require("dotenv").config();

const http = require("http");

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

// ======================================================
// ENVIRONMENT VARIABLES
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LAMPOON_ICON_URL =
  process.env.LAMPOON_ICON_URL || "";

const MOD_LOG_CHANNEL_ID =
  process.env.MOD_LOG_CHANNEL_ID || "";

const NORMAL_TIMEOUT_MINUTES =
  Number(process.env.MODERATION_TIMEOUT_MINUTES) || 10;

const REPEATED_TIMEOUT_MINUTES =
  Number(process.env.REPEATED_VIOLATION_TIMEOUT_MINUTES) || 30;

const SERIOUS_TIMEOUT_MINUTES =
  Number(process.env.SERIOUS_VIOLATION_TIMEOUT_MINUTES) || 60;

const STICKY_COLOR = "#D4AF37";

// ======================================================
// BASIC VALIDATION
// ======================================================

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing.");
  process.exit(1);
}

// ======================================================
// RENDER HEALTH CHECK
// ======================================================

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

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

// ======================================================
// CHANNEL RULES
// ======================================================
//
// Replace every *_ID placeholder with your actual
// Discord channel ID.
//
// ======================================================

const CHANNEL_RULES = {

  // ====================================================
  // COMMUNITY
  // ====================================================

  "1544771901308796929": {
    name: "Community Profile Showcase",
    type: "media",
    ruleTitle: "PROFILE SHOWCASE",
    ruleText:
      "Honor of Kings profile screenshots or videos only.",
  },

  "1544771836175196204": {
    name: "Community Skin Showcase",
    type: "media",
    ruleTitle: "SKIN SHOWCASE",
    ruleText:
      "Honor of Kings skin showcases, skin previews, skin collections, skin reveals, screenshots or videos only.",
  },

  "1544771692025483315": {
    name: "Community Hero Highlight",
    type: "video",
    ruleTitle: "HERO HIGHLIGHT",
    ruleText:
      "Honor of Kings gameplay highlight videos only.",
  },

  "1541020560929198090": {
    name: "Community HOK Meme Share",
    type: "media",
    ruleTitle: "MEME",
    ruleText:
      "Funny Honor of Kings or community-related memes only. Harassment, hateful content, sexual/explicit content, threats, doxxing and other prohibited content are not allowed.",
  },

  "1541020395426283521": {
    name: "Community Event Code Share",
    type: "code",
    ruleTitle: "EVENT CODE",
    ruleText:
      "Honor of Kings event/share codes. Text codes and screenshots containing codes are allowed.",
  },

  "1541020395426283521": {
    name: "Community HOK Fan Art",
    type: "fanart",
    ruleTitle: "HOK FAN ART",
    ruleText:
      "Honor of Kings fan-created artwork featuring heroes, skins or characters. AI-generated artwork is not allowed.",
  },

  "1541019792394158080": {
    name: "Community Build Tips Guide",
    type: "build",
    ruleTitle: "BUILD TIPS GUIDE",
    ruleText:
      "Honor of Kings build guides, Arcana, items, shop builds, match results, statistics, recommendations, map awareness, ganking, rotations and educational gameplay tips.",
  },

  // ====================================================
  // LAMPOON
  // ====================================================

  "1544183278779764742": {
    name: "Lampoon Profile Showcase",
    type: "media",
    ruleTitle: "PROFILE SHOWCASE",
    ruleText:
      "Honor of Kings profile screenshots or videos only.",
  },

  "1544183056867393599": {
    name: "Lampoon Skin Showcase",
    type: "media",
    ruleTitle: "SKIN SHOWCASE",
    ruleText:
      "Honor of Kings skin showcases, skin previews, skin collections, skin reveals, screenshots or videos only.",
  },

  "1544181729097687120": {
    name: "Lampoon Hero Highlight",
    type: "video",
    ruleTitle: "HERO HIGHLIGHT",
    ruleText:
      "Honor of Kings gameplay highlight videos only.",
  },

  "1543552879942434837": {
    name: "Lampoon Standpost Meme",
    type: "media",
    ruleTitle: "MEME",
    ruleText:
      "Funny Honor of Kings or community-related memes only. Harassment, hateful content, sexual/explicit content, threats, doxxing and other prohibited content are not allowed.",
  },

  "1544182436353810432": {
    name: "Lampoon Event Share Code",
    type: "code",
    ruleTitle: "EVENT CODE",
    ruleText:
      "Honor of Kings event/share codes. Text codes and screenshots containing codes are allowed.",
  },
};

// ======================================================
// STAFF BYPASS
// ======================================================

function isStaff(member) {

  if (!member) {
    return false;
  }

  return (
    member.permissions.has(
      PermissionsBitField.Flags.ManageMessages
    ) ||
    member.permissions.has(
      PermissionsBitField.Flags.ManageGuild
    ) ||
    member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  );
}

// ======================================================
// STICKY MESSAGE STORAGE
// ======================================================

const stickyMessages = new Map();

// ======================================================
// VIOLATION STORAGE
// ======================================================
//
// userId -> {
//   count,
//   lastViolation
// }
//
// This is runtime memory. It resets when the bot restarts.
//

const violations = new Map();

// ======================================================
// CREATE STICKY EMBED
// ======================================================

function createStickyEmbed(rule) {

  const embed = new EmbedBuilder()
    .setColor(STICKY_COLOR)
    .setTitle("READ CHANNEL'S TOPIC !")
    .setDescription(
      `**${rule.ruleTitle}**\n\n` +
      `${rule.ruleText}\n\n` +
      `💬 **Captions, descriptions, titles and quotes are allowed.**\n\n` +
      `🚫 **Do not reply to another member's post.**\n\n` +
      `🚫 **Unrelated content will be removed.**`
    );

  if (LAMPOON_ICON_URL) {
    embed.setThumbnail(LAMPOON_ICON_URL);
  }

  return embed;
}

// ======================================================
// REFRESH STICKY
// ======================================================

async function refreshSticky(channel) {

  const rule = CHANNEL_RULES[channel.id];

  if (!rule) {
    return;
  }

  try {

    const oldMessageId =
      stickyMessages.get(channel.id);

    if (oldMessageId) {

      try {

        const oldMessage =
          await channel.messages.fetch(oldMessageId);

        await oldMessage.delete();

      } catch {
        // Previous sticky already deleted.
      }
    }

    const newMessage =
      await channel.send({
        embeds: [
          createStickyEmbed(rule)
        ],
      });

    stickyMessages.set(
      channel.id,
      newMessage.id
    );

    return newMessage;

  } catch (error) {

    console.error(
      `❌ Unable to refresh sticky in ${channel.id}:`,
      error
    );
  }
}

// ======================================================
// ATTACHMENT DETECTION
// ======================================================

function isImage(attachment) {

  const contentType =
    attachment.contentType || "";

  return (
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(
      attachment.name
    )
  );
}

function isVideo(attachment) {

  const contentType =
    attachment.contentType || "";

  return (
    contentType.startsWith("video/") ||
    /\.(mp4|mov|webm|mkv|avi)$/i.test(
      attachment.name
    )
  );
}

function hasImage(message) {

  return message.attachments.some(
    (attachment) =>
      isImage(attachment)
  );
}

function hasVideo(message) {

  return message.attachments.some(
    (attachment) =>
      isVideo(attachment)
  );
}

// ======================================================
// CODE DETECTION
// ======================================================

function containsPossibleCode(text) {

  if (!text) {
    return false;
  }

  const cleaned =
    text.trim();

  const patterns = [

    // Alphanumeric code
    /\b[A-Z0-9]{5,}\b/i,

    // CODE-1234
    /\b[A-Z0-9]{3,}[-_][A-Z0-9]{2,}\b/i,

    // Numeric code
    /\b\d{5,}\b/,
  ];

  return patterns.some(
    (pattern) =>
      pattern.test(cleaned)
  );
}

// ======================================================
// MESSAGE VALIDATION
// ======================================================

function isValidMessage(message, rule) {

  const content =
    message.content || "";

  switch (rule.type) {

    // ----------------------------------------------
    // IMAGE OR VIDEO
    // ----------------------------------------------

    case "media":

      return (
        hasImage(message) ||
        hasVideo(message)
      );

    // ----------------------------------------------
    // VIDEO ONLY
    // ----------------------------------------------

    case "video":

      return hasVideo(message);

    // ----------------------------------------------
    // IMAGE ONLY
    // ----------------------------------------------

    case "image":

      return hasImage(message);

    // ----------------------------------------------
    // EVENT CODE
    // ----------------------------------------------

    case "code":

      return (
        containsPossibleCode(content) ||
        [...message.attachments.values()]
          .some(
            (attachment) =>
              isImage(attachment) ||
              isVideo(attachment)
          )
      );

    // ----------------------------------------------
    // FAN ART
    // ----------------------------------------------

    case "fanart":

      return (
        hasImage(message) ||
        hasVideo(message)
      );

    // ----------------------------------------------
    // BUILD GUIDE
    // ----------------------------------------------

    case "build":

      return (
        content.length > 0 ||
        hasImage(message) ||
        hasVideo(message)
      );

    default:

      return true;
  }
}

// ======================================================
// MODERATION LOG
// ======================================================

async function sendModerationLog(
  message,
  reason,
  action = "MESSAGE REMOVED",
  timeoutDuration = null
) {

  if (!MOD_LOG_CHANNEL_ID) {
    return;
  }

  try {

    const logChannel =
      await message.guild.channels.fetch(
        MOD_LOG_CHANNEL_ID
      );

    if (!logChannel) {
      return;
    }

    const embed =
      new EmbedBuilder()
        .setColor(STICKY_COLOR)
        .setTitle(
          "Reminder Bot — Moderation"
        )
        .addFields(

          {
            name: "Member",
            value:
              `${message.author} ` +
              `(${message.author.id})`,
          },

          {
            name: "Channel",
            value:
              `${message.channel}`,
          },

          {
            name: "Action",
            value:
              action,
          },

          {
            name: "Reason",
            value:
              reason,
          }
        )
        .setTimestamp();

    if (timeoutDuration) {

      embed.addFields({
        name: "Timeout",
        value:
          `${timeoutDuration} minute(s)`,
      });
    }

    await logChannel.send({
      embeds: [embed],
    });

  } catch (error) {

    console.error(
      "❌ Moderation log error:",
      error
    );
  }
}

// ======================================================
// REGISTER VIOLATION
// ======================================================

function registerViolation(userId) {

  const existing =
    violations.get(userId) || {
      count: 0,
      lastViolation: 0,
    };

  existing.count += 1;
  existing.lastViolation =
    Date.now();

  violations.set(
    userId,
    existing
  );

  return existing.count;
}

// ======================================================
// APPLY TIMEOUT
// ======================================================

async function applyTimeout(
  member,
  minutes,
  reason
) {

  if (!member) {
    return false;
  }

  if (!member.moderatable) {

    console.warn(
      `⚠️ Cannot timeout ${member.user.tag}. ` +
      `Check role hierarchy and Moderate Members permission.`
    );

    return false;
  }

  try {

    await member.timeout(
      minutes * 60 * 1000,
      reason
    );

    return true;

  } catch (error) {

    console.error(
      `❌ Failed to timeout ${member.user.tag}:`,
      error
    );

    return false;
  }
}

// ======================================================
// REMOVE MESSAGE + MODERATION
// ======================================================

async function removeMessage(
  message,
  reason
) {

  let action =
    "MESSAGE REMOVED";

  let timeoutMinutes = null;

  // ----------------------------------------------
  // REGISTER VIOLATION
  // ----------------------------------------------

  const violationCount =
    registerViolation(
      message.author.id
    );

  // ----------------------------------------------
  // REPEATED VIOLATIONS
  // ----------------------------------------------

  if (violationCount >= 3) {

    timeoutMinutes =
      REPEATED_TIMEOUT_MINUTES;

    const timeoutSuccess =
      await applyTimeout(
        message.member,
        timeoutMinutes,
        `Reminder Bot: repeated channel violations (${violationCount})`
      );

    if (timeoutSuccess) {

      action =
        "MESSAGE REMOVED + TIMEOUT";

    } else {

      action =
        "MESSAGE REMOVED + TIMEOUT FAILED";
    }

  } else {

    timeoutMinutes = null;
  }

  // ----------------------------------------------
  // DELETE MESSAGE
  // ----------------------------------------------

  try {

    await message.delete();

  } catch (error) {

    console.error(
      "❌ Could not delete message:",
      error
    );
  }

  // ----------------------------------------------
  // LOG
  // ----------------------------------------------

  await sendModerationLog(
    message,
    `${reason} | Violation #${violationCount}`,
    action,
    timeoutMinutes
  );

  // ----------------------------------------------
  // RETURN STICKY TO BOTTOM
  // ----------------------------------------------

  await refreshSticky(
    message.channel
  );
}

// ======================================================
// MESSAGE CREATE
// ======================================================

client.on(
  "messageCreate",
  async (message) => {

    try {

      // --------------------------------------------
      // IGNORE DMs
      // --------------------------------------------

      if (!message.guild) {
        return;
      }

      // --------------------------------------------
      // IGNORE BOTS
      // --------------------------------------------

      if (message.author.bot) {
        return;
      }

      // --------------------------------------------
      // CHECK CONFIGURED CHANNEL
      // --------------------------------------------

      const rule =
        CHANNEL_RULES[
          message.channel.id
        ];

      if (!rule) {
        return;
      }

      // --------------------------------------------
      // STAFF BYPASS
      // --------------------------------------------

      if (
        isStaff(
          message.member
        )
      ) {

        await refreshSticky(
          message.channel
        );

        return;
      }

      // --------------------------------------------
      // REPLIES ARE NOT ALLOWED
      // --------------------------------------------

      if (message.reference) {

        await removeMessage(
          message,
          "Replies are not allowed in this showcase channel."
        );

        return;
      }

      // --------------------------------------------
      // VALIDATE CONTENT
      // --------------------------------------------

      const valid =
        isValidMessage(
          message,
          rule
        );

      if (!valid) {

        await removeMessage(
          message,
          `Message does not meet the ${rule.ruleTitle} channel requirements.`
        );

        return;
      }

      // --------------------------------------------
      // VALID MESSAGE
      // --------------------------------------------

      await refreshSticky(
        message.channel
      );

    } catch (error) {

      console.error(
        "❌ messageCreate error:",
        error
      );
    }
  }
);

// ======================================================
// READY
// ======================================================

client.once(
  "ready",
  async () => {

    console.log(
      `✅ Logged in as ${client.user.tag}`
    );

    console.log(
      "🤖 Reminder Bot is online."
    );

    console.log(
      `📌 Configured channels: ${
        Object.keys(CHANNEL_RULES).length
      }`
    );

    console.log(
      `⏱️ Normal timeout: ${
        NORMAL_TIMEOUT_MINUTES
      } minutes`
    );

    console.log(
      `⏱️ Repeated violation timeout: ${
        REPEATED_TIMEOUT_MINUTES
      } minutes`
    );

    console.log(
      `⏱️ Serious timeout setting: ${
        SERIOUS_TIMEOUT_MINUTES
      } minutes`
    );

    // ----------------------------------------------
    // INITIALIZE STICKIES
    // ----------------------------------------------

    for (
      const channelId
      of Object.keys(CHANNEL_RULES)
    ) {

      try {

        const channel =
          await client.channels.fetch(
            channelId
          );

        if (
          channel &&
          channel.isTextBased()
        ) {

          await refreshSticky(
            channel
          );
        }

      } catch (error) {

        console.error(
          `⚠️ Could not initialize channel ${channelId}:`,
          error.message
        );
      }
    }
  }
);

// ======================================================
// SLASH COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName("sticky-refresh")
    .setDescription(
      "Refresh the sticky reminder in this channel."
    ),

  new SlashCommandBuilder()
    .setName("sticky-remove")
    .setDescription(
      "Remove the current sticky reminder."
    ),

  new SlashCommandBuilder()
    .setName("sticky-list")
    .setDescription(
      "Show configured Reminder Bot channels."
    ),

  new SlashCommandBuilder()
    .setName("sticky-setup")
    .setDescription(
      "Create or refresh the sticky reminder."
    ),
];

// ======================================================
// REGISTER COMMANDS
// ======================================================

async function registerCommands() {

  const rest =
    new REST({
      version: "10",
    }).setToken(TOKEN);

  try {

    if (GUILD_ID) {

      await rest.put(
        Routes.applicationGuildCommands(
          CLIENT_ID,
          GUILD_ID
        ),
        {
          body:
            commands.map(
              (command) =>
                command.toJSON()
            ),
        }
      );

      console.log(
        "✅ Guild slash commands registered."
      );

    } else {

      await rest.put(
        Routes.applicationCommands(
          CLIENT_ID
        ),
        {
          body:
            commands.map(
              (command) =>
                command.toJSON()
            ),
        }
      );

      console.log(
        "✅ Global slash commands registered."
      );
    }

  } catch (error) {

    console.error(
      "❌ Slash command registration failed:",
      error
    );
  }
}

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  "interactionCreate",
  async (interaction) => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    if (!interaction.guild) {

      return interaction.reply({
        content:
          "This command can only be used inside a server.",
        ephemeral: true,
      });
    }

    // ----------------------------------------------
    // STAFF ONLY
    // ----------------------------------------------

    if (
      !isStaff(
        interaction.member
      )
    ) {

      return interaction.reply({
        content:
          "❌ You don't have permission to use this command.",
        ephemeral: true,
      });
    }

    // ----------------------------------------------
    // REFRESH
    // ----------------------------------------------

    if (
      interaction.commandName ===
      "sticky-refresh"
    ) {

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

      await refreshSticky(
        interaction.channel
      );

      return interaction.reply({
        content:
          "✅ Sticky reminder refreshed.",
        ephemeral: true,
      });
    }

    // ----------------------------------------------
    // REMOVE
    // ----------------------------------------------

    if (
      interaction.commandName ===
      "sticky-remove"
    ) {

      const oldMessageId =
        stickyMessages.get(
          interaction.channel.id
        );

      if (!oldMessageId) {

        return interaction.reply({
          content:
            "ℹ️ No sticky message is currently tracked.",
          ephemeral: true,
        });
      }

      try {

        const oldMessage =
          await interaction.channel.messages.fetch(
            oldMessageId
          );

        await oldMessage.delete();

      } catch {
        // Already deleted.
      }

      stickyMessages.delete(
        interaction.channel.id
      );

      return interaction.reply({
        content:
          "✅ Sticky reminder removed.",
        ephemeral: true,
      });
    }

    // ----------------------------------------------
    // LIST
    // ----------------------------------------------

    if (
      interaction.commandName ===
      "sticky-list"
    ) {

      const channels =
        Object.entries(
          CHANNEL_RULES
        )
          .map(
            ([id, rule]) =>
              `• <#${id}> — **${rule.ruleTitle}**`
          )
          .join("\n");

      const embed =
        new EmbedBuilder()
          .setColor(STICKY_COLOR)
          .setTitle(
            "Reminder Bot — Configured Channels"
          )
          .setDescription(
            channels ||
            "No channels configured."
          );

      if (LAMPOON_ICON_URL) {

        embed.setThumbnail(
          LAMPOON_ICON_URL
        );
      }

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // ----------------------------------------------
    // SETUP
    // ----------------------------------------------

    if (
      interaction.commandName ===
      "sticky-setup"
    ) {

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

      await refreshSticky(
        interaction.channel
      );

      return interaction.reply({
        content:
          "✅ Sticky reminder created/refreshed.",
        ephemeral: true,
      });
    }
  }
);

// ======================================================
// DISCORD ERRORS
// ======================================================

client.on(
  "error",
  (error) => {

    console.error(
      "❌ Discord client error:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (error) => {

    console.error(
      "❌ Unhandled promise rejection:",
      error
    );
  }
);

// ======================================================
// START
// ======================================================

registerCommands();

client.login(TOKEN);
