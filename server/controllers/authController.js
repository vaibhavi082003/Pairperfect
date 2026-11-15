const jwt = require("jsonwebtoken");
const User = require("../models/User");
const otpStore = new Map();

// Helper to generate JWT Token
const makeToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "pairperfect_secret_key", { expiresIn: "7d" });

/* =======================================================
   1. REGISTER
======================================================= */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Sab fields zaroori hain" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password kam se kam 6 aksharon ka hona chahiye" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered hai" });
    }

    const user = await User.create({ 
      name: name.trim(), 
      email: email.toLowerCase().trim(), 
      password 
    });
    
    res.status(201).json({
      token: makeToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileCreated: user.profileCreated,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =======================================================
   2. LOGIN
======================================================= */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email aur Password dono dalein" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Email ya password galat hai" });
    }

    res.json({
      token: makeToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileCreated: user.profileCreated,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =======================================================
   3. GET CURRENT USER
======================================================= */
const getMe = async (req, res) => {
  try {
    const u = req.user;
    res.json({
      id: u._id,
      name: u.name,
      email: u.email,
      profileCreated: u.profileCreated,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =======================================================
   4. RESET / FORGOT PASSWORD
======================================================= */
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, password } = req.body;
    const finalPassword = newPassword || password;

    if (!email || !finalPassword) {
      return res.status(400).json({ message: "Email aur Naya Password dono zaroori hain" });
    }

    if (finalPassword.length < 6) {
      return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) {
      return res.status(404).json({ message: "Is email se koi account nahi mila" });
    }

    // pre('save') hook password hash kar dega
    user.password = finalPassword;
    await user.save();

    res.json({ message: "Password kamyabi se badal gaya! Ab naye password se login karein." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Forgot password route ke liye alias
const forgotPassword = resetPassword;

/* =======================================================
   📲 5. SEND PHONE OTP (CreateProfile ke liye)
======================================================= */
const sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Kripya valid 10-digit Indian mobile number dalein." });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(phone, {
      otp: generatedOtp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min validity
    });

    // 🚀 Dev mode me terminal me print hoga
    console.log("\n========================================");
    console.log("🔐 [PAIRPERFECT OTP ALERT]");
    console.log(`📞 Phone Number: +91 ${phone}`);
    console.log(`✨ Generated OTP: ${generatedOtp}`);
    console.log("💡 Master Test OTP: '123456'");
    console.log("========================================\n");

    return res.status(200).json({
      success: true,
      message: "OTP bhej diya gaya hai! (Dev mode: terminal me check karein ya use '123456')",
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({ message: "OTP bhejne me problem aayi." });
  }
};

/* =======================================================
   ✅ 6. VERIFY PHONE OTP
======================================================= */
const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone aur OTP dono anivarya hain." });
    }

    // Dev bypass test OTP
    if (otp === "123456") {
      otpStore.delete(phone);
      return res.status(200).json({ success: true, message: "Mobile number successfully verified! ✓" });
    }

    const storedData = otpStore.get(phone);

    if (!storedData) {
      return res.status(400).json({ message: "OTP expire ho chuka hai ya request nahi mili. Dobara mangayein." });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ message: "OTP expire ho gaya hai. Dobara OTP mangayein." });
    }

    if (storedData.otp !== otp.toString().trim()) {
      return res.status(400).json({ message: "Galat OTP! Kripya sahi OTP enter karein." });
    }

    otpStore.delete(phone);
    return res.status(200).json({
      success: true,
      message: "Mobile number successfully verified! ✓",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ message: "Server error verifying OTP." });
  }
};

/* =======================================================
   CLEAN EXPORTS
======================================================= */
module.exports = {
  register,
  login,
  getMe,
  resetPassword,
  forgotPassword,
  sendPhoneOtp,
  verifyPhoneOtp,
};