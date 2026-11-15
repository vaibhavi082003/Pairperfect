const router = require("express").Router();
const {
  register,
  login,
  getMe,
  resetPassword,
  forgotPassword,
  sendPhoneOtp,    // 👈 Naya add kiya
  verifyPhoneOtp,  // 👈 Naya add kiya
} = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/reset-password", resetPassword);
router.post("/forgot-password", forgotPassword);
router.get("/me", auth, getMe);

// 📲 Phone Verification Routes (CreateProfile ke liye)
router.post("/send-phone-otp", sendPhoneOtp);     // 👈 Naya route
router.post("/verify-phone-otp", verifyPhoneOtp); // 👈 Naya route

module.exports = router;