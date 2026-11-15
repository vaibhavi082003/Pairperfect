const express = require("express");
const router = express.Router();
const Connection = require("../models/Connection");
const User = require("../models/User"); // या Profile model
const protect = require("../middleware/authMiddleware"); // आपका JWT ऑथेंटिकेशन मिडलवेयर

// 1. coonection request send
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (req.user._id.toString() === receiverId) {
      return res.status(400).json({ message: "Khud ko request nahi bhej sakte" });
    }

    let connection = await Connection.findOne({
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id },
      ],
    });

    if (connection) {
      return res.status(400).json({ message: "Request already exists", status: connection.status });
    }

    connection = await Connection.create({
      sender: req.user._id,
      receiver: receiverId,
      status: "pending",
    });

    res.status(201).json(connection);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. connection (accept/reject) respond
router.post("/respond", protect, async (req, res) => {
  try {
    const { connectionId, status } = req.body; // status: 'accepted' | 'rejected'
    const connection = await Connection.findOne({ _id: connectionId, receiver: req.user._id });

    if (!connection) {
      return res.status(404).json({ message: "Request nahi mili" });
    }

    connection.status = status;
    await connection.save();

    res.json({ message: `Request ${status}`, connection });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. pending notifications (received requests)
router.get("/pending", protect, async (req, res) => {
  try {
    const pending = await Connection.find({ receiver: req.user._id, status: "pending" })
      .populate("sender", "name email");
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. (Connected Matches for Chat)
router.get("/accepted", protect, async (req, res) => {
  try {
    const connections = await Connection.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
      status: "accepted",
    }).populate("sender receiver", "name email");

    // सामने वाले व्यक्ति का ऑब्जेक्ट निकालें
    const matchedUsers = connections.map((c) => {
      return c.sender._id.toString() === req.user._id.toString() ? c.receiver : c.sender;
    });

    res.json(matchedUsers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;