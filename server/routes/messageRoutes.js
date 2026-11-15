const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Message = require("../models/messages");
const protect = require("../middleware/authMiddleware");

const router = express.Router();
const MEDIA_TYPES = new Set(["image", "video", "audio", "document"]);
const MAX_TEXT_LENGTH = 5000;
const MAX_MEDIA_URL_LENGTH = 2048;
const uploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 100) || "upload";
    callback(null, `${baseName}-${Date.now()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = /^(image|video|audio)\//;
    const allowedDocumentTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ]);

    if (allowedMimeTypes.test(file.mimetype) || allowedDocumentTypes.has(file.mimetype)) {
      return callback(null, true);
    }
    return callback(new Error("Unsupported file type"));
  },
});

const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "File exceeds the 30 MB limit" });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(415).json({ message: error.message || "Unsupported file type" });
  });
};

const isValidId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const populateReply = (message) =>
  message.populate({
    path: "replyTo",
    select: "text sender mediaUrl mediaType fileName createdAt",
    populate: { path: "sender", select: "name fullName" },
  });

const isParticipant = (message, userId) =>
  message.sender.toString() === userId || message.receiver.toString() === userId;

// POST /api/messages/upload — upload one image, video, audio, or document.
router.post("/upload", protect, handleUpload, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const { file } = req;
  const mime = file.mimetype;
  const mediaType = mime.startsWith("image/")
    ? "image"
    : mime.startsWith("video/")
      ? "video"
      : mime.startsWith("audio/")
        ? "audio"
        : "document";
  const units = ["Bytes", "KB", "MB", "GB"];
  const unitIndex = file.size ? Math.min(Math.floor(Math.log(file.size) / Math.log(1024)), units.length - 1) : 0;
  const fileSize = `${(file.size / Math.pow(1024, unitIndex)).toFixed(1)} ${units[unitIndex]}`;

  return res.status(200).json({
    url: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(file.filename)}`,
    mediaType,
    fileName: file.originalname,
    fileSize,
  });
});

// GET /api/messages/:targetUserId — chronological history for one conversation.
router.get("/:targetUserId", protect, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const myId = req.user._id;

    if (!isValidId(targetUserId)) {
      return res.status(400).json({ message: "Invalid target user ID" });
    }
    if (targetUserId === myId.toString()) {
      return res.status(400).json({ message: "You cannot open a chat with yourself" });
    }

    const history = await Message.find({
      $or: [
        { sender: myId, receiver: targetUserId },
        { sender: targetUserId, receiver: myId },
      ],
    })
      .populate({
        path: "replyTo",
        select: "text sender mediaUrl mediaType fileName createdAt",
        populate: { path: "sender", select: "name fullName" },
      })
      .sort({ createdAt: 1 });

    return res.status(200).json(history);
  } catch (error) {
    console.error("Fetch chat history failed:", error);
    return res.status(500).json({ message: "Unable to fetch chat history" });
  }
});

// POST /api/messages — create a text, media, or reply message.
router.post("/", protect, async (req, res) => {
  try {
    const {
      receiverId,
      text = "",
      mediaUrl = null,
      mediaType = null,
      fileName = null,
      fileSize = null,
      replyTo = null,
    } = req.body || {};
    const senderId = req.user._id;

    if (!isValidId(receiverId)) {
      return res.status(400).json({ message: "A valid receiverId is required" });
    }
    if (receiverId === senderId.toString()) {
      return res.status(400).json({ message: "You cannot send a message to yourself" });
    }
    if (typeof text !== "string" || text.trim().length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `Message text must be at most ${MAX_TEXT_LENGTH} characters` });
    }
    if (
      mediaUrl !== null &&
      (typeof mediaUrl !== "string" || !mediaUrl.trim() || mediaUrl.length > MAX_MEDIA_URL_LENGTH)
    ) {
      return res.status(400).json({ message: "mediaUrl must be a non-empty URL or path within the allowed length" });
    }
    if (mediaUrl && !MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ message: "A valid mediaType is required when mediaUrl is provided" });
    }
    if (!mediaUrl && mediaType !== null) {
      return res.status(400).json({ message: "mediaType requires a mediaUrl" });
    }
    if (!text.trim() && !mediaUrl) {
      return res.status(400).json({ message: "A message must contain text or media" });
    }
    if (fileName !== null && (typeof fileName !== "string" || fileName.length > 255)) {
      return res.status(400).json({ message: "fileName must be a string of at most 255 characters" });
    }
    if (fileSize !== null && (typeof fileSize !== "string" || fileSize.length > 64)) {
      return res.status(400).json({ message: "fileSize must be a string of at most 64 characters" });
    }

    if (replyTo !== null) {
      if (!isValidId(replyTo)) {
        return res.status(400).json({ message: "Invalid replyTo message ID" });
      }

      const repliedMessage = await Message.findById(replyTo).select("sender receiver");
      const sameConversation =
        repliedMessage &&
        [repliedMessage.sender.toString(), repliedMessage.receiver.toString()].includes(senderId.toString()) &&
        [repliedMessage.sender.toString(), repliedMessage.receiver.toString()].includes(receiverId);

      if (!sameConversation) {
        return res.status(400).json({ message: "replyTo must reference a message in this conversation" });
      }
    }

    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      text: text.trim(),
      mediaUrl: mediaUrl ? mediaUrl.trim() : null,
      mediaType: mediaUrl ? mediaType : null,
      fileName,
      fileSize,
      replyTo,
      status: "sent",
    });

    await populateReply(message);
    return res.status(201).json(message);
  } catch (error) {
    console.error("Create message failed:", error);
    return res.status(500).json({ message: "Unable to create message" });
  }
});

// PUT /api/messages/:messageId/edit — only the sender may edit.
router.put("/:messageId/edit", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body || {};
    if (!isValidId(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }
    if (typeof text !== "string" || text.trim().length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `Message text must be a string of at most ${MAX_TEXT_LENGTH} characters` });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the sender can edit this message" });
    }
    if (!text.trim() && !message.mediaUrl) {
      return res.status(400).json({ message: "A text-only message cannot be empty" });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();
    await populateReply(message);
    return res.status(200).json(message);
  } catch (error) {
    console.error("Edit message failed:", error);
    return res.status(500).json({ message: "Unable to edit message" });
  }
});

// PATCH /api/messages/:messageId/status — receiver advances delivery status.
router.patch("/:messageId/status", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body || {};
    if (!isValidId(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }
    if (!["delivered", "seen"].includes(status)) {
      return res.status(400).json({ message: "Status must be delivered or seen" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the receiver can update delivery status" });
    }

    const statusRank = { sent: 0, delivered: 1, seen: 2 };
    if (statusRank[status] > statusRank[message.status]) {
      message.status = status;
      await message.save();
    }
    await populateReply(message);
    return res.status(200).json(message);
  } catch (error) {
    console.error("Update message status failed:", error);
    return res.status(500).json({ message: "Unable to update message status" });
  }
});

// DELETE /api/messages/:messageId — sender-only unsend.
router.delete("/:messageId", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!isValidId(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the sender can delete this message" });
    }

    await message.deleteOne();
    return res.status(200).json({
      success: true,
      messageId,
      receiverId: message.receiver,
    });
  } catch (error) {
    console.error("Delete message failed:", error);
    return res.status(500).json({ message: "Unable to delete message" });
  }
});

// POST /api/messages/:messageId/react — one toggleable reaction per user.
router.post("/:messageId/react", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";
    if (!isValidId(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }
    if (!emoji || emoji.length > 32) {
      return res.status(400).json({ message: "A valid emoji reaction is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (!isParticipant(message, req.user._id.toString())) {
      return res.status(403).json({ message: "You cannot react to this message" });
    }

    const reactionIndex = message.reactions.findIndex(
      (reaction) => reaction.user.toString() === req.user._id.toString()
    );
    if (reactionIndex >= 0) {
      if (message.reactions[reactionIndex].emoji === emoji) {
        message.reactions.splice(reactionIndex, 1);
      } else {
        message.reactions[reactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();
    await populateReply(message);
    return res.status(200).json(message);
  } catch (error) {
    console.error("React to message failed:", error);
    return res.status(500).json({ message: "Unable to update message reaction" });
  }
});

module.exports = router;
