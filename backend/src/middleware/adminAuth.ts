import type { Request, Response, NextFunction } from "express";

/**
 * Optional admin protection for API routes.
 * If ADMIN_PASSWORD is set, clients must send header: x-admin-password
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return next();

  const got = req.header("x-admin-password");
  if (got && got === adminPassword) return next();

  return res.status(401).json({ ok: false, error: "Unauthorized" });
}
