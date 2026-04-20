import type { Request, Response } from "express";
import "dotenv/config";
import { applicationsTable, usersTable } from "../models/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../utils/token";
import jose from "node-jose";
import { PUBLIC_KEY } from "../utils/cert";
import path from "node:path";
import crypto from "node:crypto";
import { JWTClaims } from "../utils/user-token";

const PORT = process.env.PORT ?? 8000;

export const wellKnownOpenIDConfigurationHandler = async (
  req: Request,
  res: Response,
) => {
  const ISSUER = `http://localhost:${PORT}`;
  return res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/o/authenticate`,
    userinfo_endpoint: `${ISSUER}/o/userinfo`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    token_endpoint: `${ISSUER}/o/tokens`,
  });
};

export const tokenHandler = async (req: Request, res: Response) => {
  const { code, client_id, client_secret } = req.body;

  const [application] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.clientId, client_id))
    .limit(1);

  if (
    !application ||
    application.code !== code ||
    application.clientSecret !== client_secret
  ) {
    return res.status(401).json({ message: "Invalid credentials or code." });
  }

  if (!application.codeExpiresAt || application.codeExpiresAt < new Date()) {
    return res.status(401).json({ message: "Code has expired." });
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, application.codeUserId!))
    .limit(1);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  await db
    .update(applicationsTable)
    .set({ code: null, codeUserId: null, codeExpiresAt: null })
    .where(eq(applicationsTable.id, application.id));

  const accessToken = generateAccessToken({
    iss: `http://localhost:${PORT}`,
    sub: user.id,
    client_id: application.clientId,
    email: user.email,
    email_verified: user.emailVerified,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    scope: "openid profile email",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const refreshToken = generateRefreshToken({
    iss: `http://localhost:${PORT}`,
    sub: user.id,
    client_id: application.clientId,
    token_type: "refresh",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  });

  return res.json({ accessToken, refreshToken });
};

export const jwksHandler = async (req: Request, res: Response) => {
  const key = await jose.JWK.asKey(PUBLIC_KEY, "pem");
  return res.json({ keys: [key.toJSON()] });
};

export const authenticateHandler = async (req: Request, res: Response) => {
  const clientId = req.query.client_id as string;

  if (!clientId) {
    res.status(400).json({ message: "Missing client_id query parameter." });
    return;
  }

  const [application] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.clientId, clientId))
    .limit(1);

  if (!application) {
    res.status(404).json({ message: "Application not found." });
    return;
  }

  return res.sendFile(path.resolve("public", "authenticate.html"));
};

export const signinHandler = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const clientId = req.query.client_id as string;

  if (!clientId) {
    res.status(400).json({ message: "Missing client_id query parameter." });
    return;
  }

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }

  const [application] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.clientId, clientId))
    .limit(1);

  if (!application) {
    res.status(404).json({ message: "Application not found." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || !user.password || !user.salt) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  const hash = crypto
    .createHash("sha256")
    .update(password + user.salt)
    .digest("hex");

  if (hash !== user.password) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  const code = crypto.randomBytes(32).toString("hex");

  await db
    .update(applicationsTable)
    .set({
      code,
      codeUserId: user.id,
      codeExpiresAt: new Date(Date.now() + 60_000),
    })
    .where(eq(applicationsTable.clientId, clientId));

  res.redirect(`${application.redirectURI}?code=${code}`);
};

export const signupHandler = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  if (!email || !password || !firstName) {
    res
      .status(400)
      .json({ message: "First name, email, and password are required." });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    res
      .status(409)
      .json({ message: "An account with this email already exists." });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");

  await db.insert(usersTable).values({
    firstName,
    lastName: lastName ?? null,
    email,
    password: hash,
    salt,
  });

  res.status(201).json({ ok: true });
};

export const userInfoHandler = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ message: "Missing or invalid Authorization header." });
    return;
  }

  const token = authHeader.slice(7);

  let claims: JWTClaims;
  try {
    claims = verifyToken(token) as JWTClaims;
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, claims.sub))
    .limit(1);

  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  res.json({
    sub: user.id,
    email: user.email,
    email_verified: user.emailVerified,
    given_name: user.firstName,
    family_name: user.lastName,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    picture: user.profileImageURL,
  });
};

export const appInfoHandler = async (req: Request, res: Response) => {
  const clientId = req.query.client_id as string;

  if (!clientId) {
    res.status(400).json({ message: "Missing client_id query parameter." });
    return;
  }

  const [application] = await db
    .select({
      applicationName: applicationsTable.applicationName,
      applicationURL: applicationsTable.applicationURL,
    })
    .from(applicationsTable)
    .where(eq(applicationsTable.clientId, clientId))
    .limit(1);

  if (!application) {
    res.status(404).json({ message: "Application not found." });
    return;
  }

  return res.json(application);
};

export const registerApplicationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { displayName, appUrl, redirectUri } = req.body;

    if (!displayName || !appUrl || !redirectUri) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    const clientId = crypto.randomBytes(16).toString("hex");
    const clientSecret = crypto.randomBytes(32).toString("hex");

    await db.insert(applicationsTable).values({
      applicationName: displayName,
      applicationURL: appUrl,
      redirectURI: redirectUri,
      clientId,
      clientSecret,
    });

    return res.json({
      clientId,
      clientSecret,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
