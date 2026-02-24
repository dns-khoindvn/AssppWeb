import { Router } from "express";
import { readDefaultAccount } from "../services/defaultAccount.js";

const router = Router();

/**
 * Public-ish endpoint: returns only email (no password).
 * If you want to hide even the email, set ADMIN_PASSWORD and protect /api with adminAuth.
 */
router.get("/default-account", (req, res) => {
  const acc = readDefaultAccount();
  if (!acc) return res.json({ ok: false });
  return res.json({ ok: true, account: { email: acc.email, createdAt: acc.createdAt } });
});

/**
 * Sensitive endpoint: returns password.
 * Protected by adminAuth middleware when ADMIN_PASSWORD is set.
 */
router.get("/default-account/credentials", (req, res) => {
  const acc = readDefaultAccount();
  if (!acc) return res.json({ ok: false });
  return res.json({ ok: true, account: { email: acc.email, password: acc.password, createdAt: acc.createdAt } });
});

export default router;
