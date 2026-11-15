const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // Header me se Bearer Token nikalna
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Token verify karna
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "pairperfect_secret_key_123"
      );

      // User find karna (password chhod kar)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "User nahi mila, authorization failed" });
      }

      return next();
    } catch (error) {
      console.error("Auth Middleware Error:", error.message);
      return res.status(401).json({ message: "Token invalid ya expire ho chuka hai" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Login zaroori hai, token nahi mila" });
  }
};

module.exports = protect;