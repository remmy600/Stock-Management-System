import { Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../utils/audit.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const user = await User.findOne({ username }).select("+passwordHash");
    if (!user || user.blocked || !(await user.checkPassword(password))) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters.");
    }

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    const safeUser = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      role: user.role
    };

    await writeAudit(safeUser, "LOGIN", "Successful sign in");
    return res.json({ token, user: safeUser });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "The new password must be at least 8 characters." });
    }

    const user = await User.findById(req.user.id).select("+passwordHash");
    if (!user || !(await user.checkPassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.passwordHash = newPassword;
    await user.save();
    await writeAudit(req.user, "PASSWORD_CHANGED", "Own account");
    return res.json({ message: "Password updated successfully." });
  } catch (error) {
    return next(error);
  }
});

export default router;
