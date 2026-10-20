const { EmbedBuilder } = require("discord.js");

let logChannel = null;

function setLogChannel(channel) {
  logChannel = channel;
}

async function logViolation(message, reason, action) {
  if (!logChannel) return;

  try {
    const embed = new EmbedBuilder()
      .setColor("#FF4444")
      .setTitle("🚫 Content Removed")
      .addFields(
        { name: "User", value: `${message.author}`, inline: true },
        { name: "Channel", value: `${message.channel}`, inline: true },
        { name: "Action", value: action, inline: true },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Failed to log violation:", error.message);
  }
}

async function removeMessage(message, reason) {
  try {
    await message.delete();
    console.log(`🗑️ Removed message in #${message.channel.name}: ${reason}`);
    await logViolation(message, reason, "Message deleted");
    return true;
  } catch (error) {
    console.error("❌ Failed to delete message:", error.message);
    return false;
  }
}

async function warnUser(message, reason) {
  try {
    await message.channel.send(`${message.author} ⚠️ ${reason}`).then(m => setTimeout(() => m.delete(), 5000));
    await logViolation(message, reason, "Warning sent");
  } catch (error) {
    console.error("❌ Failed to warn user:", error.message);
  }
}

module.exports = { setLogChannel, removeMessage, warnUser, logViolation };
