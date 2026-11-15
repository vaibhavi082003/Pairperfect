require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const Message = require("./models/messages");

const app = express();
connectDB();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  dotfiles: "deny",
  index: false,
  maxAge: "1d",
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.set("io", io);

// ⚡ Active Online Users Map (userId -> socketId)
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log(`⚡ Connected: ${socket.id}`);

  // 1. जब यूज़र ऐप पर आता है
  socket.on("joinUser", async (userId) => {
    if (!userId) return;
    onlineUsers.set(userId.toString(), socket.id);
    socket.join(userId.toString());

    // सभी को बताएं कि कौन-कौन ऑनलाइन है
    io.emit("onlineUsersList", Array.from(onlineUsers.keys()));

    // जब यह यूज़र ऑनलाइन आया, तो इसके जितने भी अनडिलीवर मैसेजेस थे उन्हें 'delivered' (✓✓) करें
    try {
      const deliveryResult = await Message.updateMany(
        { receiver: userId, status: "sent" },
        { status: "delivered" }
      );
      // सेंडर्स को सूचित करें कि उनके मैसेजेस अब डिलीवर हो गए हैं
      if (deliveryResult.modifiedCount > 0) {
        socket.broadcast.emit("messagesDeliveredToUser", {
          byUserId: userId.toString(),
          receiverId: userId.toString(),
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // 2. जब यूज़र मैसेज भेजता है
  socket.on("sendMessage", async (data = {}) => {
    const {
      senderId,
      receiverId,
      text = "",
      tempId,
      replyTo = null,
      mediaUrl = null,
      mediaType = null,
      fileName = null,
      fileSize = null,
    } = data;

    try {
      if (!senderId || !receiverId || senderId.toString() === receiverId.toString()) {
        return socket.emit("messageSendError", { tempId, message: "Invalid sender or receiver" });
      }
      if (typeof text !== "string" || text.trim().length > 5000) {
        return socket.emit("messageSendError", { tempId, message: "Message text is invalid or too long" });
      }
      if (mediaUrl && (typeof mediaUrl !== "string" || !["image", "video", "audio", "document"].includes(mediaType))) {
        return socket.emit("messageSendError", { tempId, message: "Media URL or type is invalid" });
      }
      if (!text.trim() && !mediaUrl) {
        return socket.emit("messageSendError", { tempId, message: "A message must contain text or media" });
      }

      if (replyTo) {
        const repliedMessage = await Message.findById(replyTo).select("sender receiver");
        const sameConversation =
          repliedMessage &&
          [repliedMessage.sender.toString(), repliedMessage.receiver.toString()].includes(senderId.toString()) &&
          [repliedMessage.sender.toString(), repliedMessage.receiver.toString()].includes(receiverId.toString());
        if (!sameConversation) {
          return socket.emit("messageSendError", { tempId, message: "Reply target is not in this conversation" });
        }
      }

      // Initial state is never "seen". It only advances after markAsSeen.
      const isReceiverOnline = onlineUsers.has(receiverId.toString());
      const initialStatus = isReceiverOnline ? "delivered" : "sent";
      const newMsg = await Message.create({
        sender: senderId,
        receiver: receiverId,
        text: text.trim(),
        mediaUrl: mediaUrl || null,
        mediaType: mediaUrl ? mediaType : null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        replyTo: replyTo || null,
        status: initialStatus,
      });
      await newMsg.populate({
        path: "replyTo",
        select: "text sender mediaUrl mediaType fileName createdAt",
      });

      socket.emit("messageSentAck", { tempId, savedMessage: newMsg });

      if (isReceiverOnline) {
        io.to(receiverId.toString()).emit("receiveMessage", newMsg);
      }
    } catch (err) {
      console.error("Save msg error:", err);
      socket.emit("messageSendError", { tempId, message: "Unable to save message" });
    }
  });

  // 3. जब रिसीवर चैट खोलता है (SEEN - 👁️ EYE ICON)
  socket.on("markAsSeen", async ({ senderId, receiverId } = {}) => {
    try {
      // Only a socket that joined as the receiver may mark this conversation seen.
      if (
        !senderId ||
        !receiverId ||
        senderId.toString() === receiverId.toString() ||
        !socket.rooms.has(receiverId.toString())
      ) return;

      // डेटाबेस में स्टेटस 'seen' करें
      const result = await Message.updateMany(
        { sender: senderId, receiver: receiverId, status: { $ne: "seen" } },
        { status: "seen" }
      );

      // सेंडर को बताएं कि सामने वाले ने मैसेज देख लिया (Eye icon दिखाएं)
      if (result.modifiedCount > 0) {
        io.to(senderId.toString()).emit("messagesMarkedSeen", {
          seenBy: receiverId.toString(),
          senderId: senderId.toString(),
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // 4. रीयल-टाइम कनेक्शन रिक्वेस्ट नोटिफिकेशन
  socket.on("sendConnectionNotification", ({ receiverId, senderName }) => {
    if (onlineUsers.has(receiverId.toString())) {
      const receiverSocketId = onlineUsers.get(receiverId.toString());
      io.to(receiverSocketId).emit("newConnectionReceived", {
        message: `${senderName} ne aapko rishte ki request bheji hai! 💌`,
      });
    }
  });

  // 5. जब यूज़र ऑफलाइन हो जाए
  socket.on("disconnect", () => {
    for (let [userId, sId] of onlineUsers.entries()) {
      if (sId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`❌ Offline: ${userId}`);
        break;
      }
    }
    io.emit("onlineUsersList", Array.from(onlineUsers.keys()));
  });
});

// Routes जोड़ें
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/connections", require("./routes/connectionRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));