const Profile = require("../models/Profile");
const User = require("../models/User");

// 1. Create or Update Profile (Upsert)
exports.createProfile = async (req, res) => {
  try {
    const { user, ...profileData } = req.body;

    // findOneAndUpdate with returnDocument: 'after' (No Warning, Fresh Data)
    const profile = await Profile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { ...profileData, user: req.user._id } },
      { returnDocument: "after", upsert: true, runValidators: true }
    );

    // User को mark करें कि Profile बन चुकी है
    await User.findByIdAndUpdate(req.user._id, { profileCreated: true });

    return res.status(200).json(profile);
  } catch (err) {
    console.error("Profile Save Error:", err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");
      return res.status(400).json({ message: messages });
    }
    return res.status(500).json({ message: err.message });
  }
};

// 2. Get My Profile (Current User)
exports.getMyProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "Profile abhi nahi bana" });
    }
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// 3. Update Profile
exports.updateMyProfile = async (req, res) => {
  try {
    const { user, ...data } = req.body;
    const profile = await Profile.findOneAndUpdate(
      { user: req.user._id },
      data,
      { returnDocument: "after", runValidators: true }
    );
    if (!profile) return res.status(404).json({ message: "Profile nahi mila" });
    return res.json(profile);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};