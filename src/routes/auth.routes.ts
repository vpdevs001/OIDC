import { Router } from "express";
import {
  appInfoHandler,
  authenticateHandler,
  jwksHandler,
  registerApplicationHandler,
  signinHandler,
  signupHandler,
  tokenHandler,
  userInfoHandler,
  wellKnownOpenIDConfigurationHandler,
} from "../controllers/auth.controller";

const router: Router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the AuthServer API" });
});

router.get(
  "/.well-known/openid-configuration",
  wellKnownOpenIDConfigurationHandler,
);

router.post("/register", registerApplicationHandler);

router.post("/o/tokens", tokenHandler);

router.get("/.well-known/jwks.json", jwksHandler);

router.get("/o/authenticate", authenticateHandler);

router.post("/o/authenticate/sign-in", signinHandler);

router.post("/o/authenticate/sign-up", signupHandler);

router.get("/o/userinfo", userInfoHandler);

router.get("/o/authenticate/app-info", appInfoHandler);

export default router;
