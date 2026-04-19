import express from "express";
import type { Express } from "express";
import { authenticationMiddleware } from "./middleware/auth-middleware.js";
import { authRouter } from "./auth/routes.js";
import { OIDCRouter } from "./oidc/routes.js";

export function createApplication(): Express {
  const app = express();

  app.use(express.json());

  app.get("/", (req, res) => {
    return res.json({ message: "Welcome to Ved Auth Service" });
  });

  app.use("/auth", authenticationMiddleware, authRouter);
  app.use("/oidc", OIDCRouter);

  return app;
}
