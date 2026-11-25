import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Sign in is required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user || user.blocked) {
      return res.status(401).json({ message: "This account is unavailable. Sign in again." });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      role: user.role
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Your session is invalid or has expired." });
  }
}

export function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    return next();
  };
}
