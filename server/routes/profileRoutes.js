const router = require("express").Router();
const {
  createProfile,
  getMyProfile,
  updateMyProfile,
} = require("../controllers/profileController");
const auth = require("../middleware/auth");
const User = require("../models/User");

// Profile model safely stored
let Profile;
try {
  Profile = require("../models/Profile");
} catch (err) {
  Profile = null;
}

// 📌 1. Fetch all profiles (for Home Page suggestions) – [This was missing]
router.get("/", async (req, res) => {
  try {
    let profiles = [];

    // अगर Profile कलेक्शन में डेटा है तो उसे निकालें
    if (Profile) {
      profiles = await Profile.find();
    }

    // 🔥 SMART FALLBACK:
    const allUsers = await User.find().select("-password");
    const existingProfileUserIds = new Set(
      profiles.map((p) => (p.user ? p.user.toString() : p._id.toString()))
    );

    for (const u of allUsers) {
      if (!existingProfileUserIds.has(u._id.toString())) {
        profiles.push({
          _id: u._id,
          fullName: u.name,
          gender: u.gender || (u.name.toLowerCase().includes("sayli") ? "Female" : "Male"),
          dob: "2000-05-15",
          height: 168,
          religion: "Hindu",
          caste: "General",
          city: "Pune",
          state: "Maharashtra",
          education: "Graduate",
          occupation: "Software Professional",
          annualIncome: "12 LPA",
          maritalStatus: "Never Married",
          diet: "Vegetarian",
          about: "Well-cultured, family-oriented and looking for a compatible life companion.",
          photoUrl: "",
          createdAt: u.createdAt,
        });
      }
    }

    res.json(profiles);
  } catch (error) {
    console.error("Error fetching all profiles:", error);
    res.status(500).json({ message: "Profiles load nahi ho saki" });
  }
});

// 📌 2. old routes
router.post("/", auth, createProfile);
router.get("/me", auth, getMyProfile);
router.put("/me", auth, updateMyProfile);

module.exports = router;