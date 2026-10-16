import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import workflowRoutes from "./routes/workflowRoutes.js";
import { createWorkflowStore } from "./models/workflowStore.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(rootDir, ".env") });

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "TeaCollector API is running!", demoApi: "/api/health" });
});

const PORT = Number(process.env.PORT || 5000);

async function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32)
      throw new Error("JWT_SECRET must contain at least 32 characters.");
    return process.env.JWT_SECRET;
  }
  const dataDir = path.join(rootDir, "data");
  await mkdir(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, ".jwt-secret");
  try {
    return (await readFile(secretPath, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const secret = crypto.randomBytes(48).toString("hex");
    await writeFile(secretPath, secret, { mode: 0o600, flag: "wx" });
    return secret;
  }
}

async function startServer() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URI;
    if (!mongoUri) throw new Error("Set MONGO_URI in backend/.env.");
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected successfully");
    const store = createWorkflowStore();
    await store.ready;
    const secret = await getJwtSecret();
    app.use("/api", workflowRoutes(store, secret));

    app.use((error, req, res, next) => {
      if (res.headersSent) return next(error);
      const status = error.status || (error.code === 11000 ? 409 : 500);
      const message = error.code === 11000
        ? "This email or vehicle number is already registered."
        : status >= 500
          ? "The server could not complete this action. Please try again."
          : error.message;
      if (status >= 500) console.error("Request failed:", error.name);
      res.status(status).json({ error: message });
    });

    app.listen(PORT, () => {
      console.log(`TeaCollector server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ TeaCollector could not start:");
    console.error(error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, "[connection hidden]"));
    process.exit(1);
  }
}

startServer();
