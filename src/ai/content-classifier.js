const fs = require("fs");
const path = require("path");

const PROMPT_DIR = path.join(__dirname, "..", "..", "prompts");

const CHANNEL_PROMPTS = {
  profile: "profile-showcase.txt",
  skin: "skin-showcase.txt",
  hero: "hero-highlight.txt",
  "hok-meme": "hok-meme.txt",
  "general-meme": "standpost-meme.txt",
  code: "code-share.txt",
  fanart: "fan-art.txt",
  build: "strategy-forum.txt",
};

function loadPrompt(channelType) {
  const filename = CHANNEL_PROMPTS[channelType];
  if (!filename) return null;
  
  const filePath = path.join(PROMPT_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  
  return fs.readFileSync(filePath, "utf-8");
}

function getPromptForChannel(channelType) {
  return loadPrompt(channelType);
}

function isAllowedReply(code, content) {
  const allowedReplies = ["done", "used", "invalid", "expired", "not work", "error"];
  return allowedReplies.includes(content.trim().toLowerCase());
}

module.exports = { getPromptForChannel, isAllowedReply };
