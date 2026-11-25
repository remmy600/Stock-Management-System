import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing. Add your MongoDB Atlas connection string.");
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("MONGODB_URI is not a valid MongoDB connection string.");
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    throw new Error("MONGODB_URI must include a database name, for example .../ububiko_smart?retryWrites=true&w=majority");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000
  });

  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
