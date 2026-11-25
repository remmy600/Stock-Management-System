import "dotenv/config";
import mongoose from "mongoose";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { connectDatabase } from "../config/database.js";
import { User } from "../models/index.js";

const rl = readline.createInterface({ input, output });

try {
  await connectDatabase();

  const existingAdmin = await User.findOne({ role: "Admin" });
  if (existingAdmin) {
    console.log(`An Admin account already exists (${existingAdmin.username}). No changes were made.`);
    process.exitCode = 0;
  } else {
    const username = (await rl.question("New Admin username: ")).trim().toLowerCase();
    const name = (await rl.question("Admin display name: ")).trim();
    const password = await rl.question("New Admin password (minimum 8 characters): ");

    if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
      throw new Error("Username must be 3–24 characters and use letters, numbers, dot, underscore or hyphen.");
    }
    if (!name || password.length < 8) {
      throw new Error("A display name and a password of at least 8 characters are required.");
    }

    await User.create({ username, name, role: "Admin", passwordHash: password });
    console.log("Admin account created successfully. Keep the password private.");
  }
} catch (error) {
  console.error("Admin setup failed:", error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await mongoose.disconnect();
}
