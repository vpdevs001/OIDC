import express from "express";
import type { Router } from "express";

import OIDCController from "./controller.js";

const oidcController = new OIDCController();

export const OIDCRouter: Router = express.Router();

OIDCRouter.get(
  "/.well-known/openid-configuration",
  oidcController.handleOpenIdConfiguration.bind(oidcController),
);
