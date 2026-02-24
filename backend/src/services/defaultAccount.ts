import fs from "fs";
import path from "path";
import { config } from "../config.js";

export interface DefaultAccount {
  email: string;
  password: string;
  createdAt: number;
}

const FILE_NAME = "default-account.json";

export function getDefaultAccountPath(): string {
  return path.resolve(config.dataDir, FILE_NAME);
}

export function seedDefaultAccountFromEnv(): void {
  const email = process.env.DEFAULT_APPLE_EMAIL?.trim();
  const password = process.env.DEFAULT_APPLE_PASSWORD;

  if (!email || !password) return;

  const filePath = getDefaultAccountPath();
  if (fs.existsSync(filePath)) return;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const acc: DefaultAccount = {
    email,
    password,
    createdAt: Date.now(),
  };

  fs.writeFileSync(filePath, JSON.stringify(acc, null, 2), "utf-8");
  // Do not log password
  console.log(`[seed] default Apple account saved: ${email}`);
}

export function readDefaultAccount(): DefaultAccount | null {
  const filePath = getDefaultAccountPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email !== "string" || typeof parsed?.password !== "string") return null;
    return {
      email: parsed.email,
      password: parsed.password,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
    };
  } catch {
    return null;
  }
}
