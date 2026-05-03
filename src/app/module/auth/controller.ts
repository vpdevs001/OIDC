import { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { createPublicKey } from "node:crypto";
import {
  exchangeAuthorizationCodeService,
  getOAuthClientService,
  registerOAuthClientService,
  signinService,
  signupService,
  userInfoService,
} from "./services.js";
import ApiError from "../../common/utils/ApiError.js";
import ApiResponse from "../../common/utils/ApiResponse.js";
import {
  oAuthClientRegister,
  tokenExchange,
  userLogin,
  userSignup,
} from "./validate.js";
import { type AuthenticatedRequest } from "./middleware.js";

const publicDir = path.resolve(process.cwd(), "public");

const getRequestValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
};

const getBody = (req: Request) =>
  req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>)
    : {};

const getAuthorizationPayload = (req: Request) => {
  const body = getBody(req);

  return {
    clientId:
      getRequestValue(body.clientId) ??
      getRequestValue(body.client_id) ??
      getRequestValue(req.query.client_id),
    redirectUri:
      getRequestValue(body.redirectUri) ??
      getRequestValue(body.redirect_uri) ??
      getRequestValue(req.query.redirect_uri),
    state: getRequestValue(body.state) ?? getRequestValue(req.query.state),
  };
};

const sendPublicPage = (res: Response, fileName: string) => {
  res.sendFile(path.resolve(publicDir, fileName));
};

export const registerClientPage = (_: Request, res: Response) => {
  sendPublicPage(res, "client-register.html");
};

export const signupPage = async (req: Request, res: Response) => {
  const { clientId, redirectUri } = getAuthorizationPayload(req);

  if (clientId) {
    await getOAuthClientService(clientId, redirectUri);
  }

  sendPublicPage(res, "signup.html");
};

export const signinPage = async (req: Request, res: Response) => {
  const { clientId, redirectUri } = getAuthorizationPayload(req);

  if (clientId) {
    await getOAuthClientService(clientId, redirectUri);
  }

  sendPublicPage(res, "signin.html");
};

export const registerOAuthClient = async (req: Request, res: Response) => {
  const result = await oAuthClientRegister.safeParseAsync(req.body);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { applicationName, applicationUrl, contactEmail, redirectUrl } =
    result.data;
  const response = await registerOAuthClientService(
    applicationName,
    contactEmail,
    applicationUrl,
    redirectUrl,
  );

  return new ApiResponse(
    res,
    201,
    "OAuth client registered successfully",
    response,
  );
};

export const signup = async (req: Request, res: Response) => {
  const payload = {
    ...req.body,
    ...getAuthorizationPayload(req),
  };
  const result = await userSignup.safeParseAsync(payload);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { clientId, email, name, password, redirectUri, state } = result.data;
  const response = await signupService(email, name, password, {
    clientId,
    redirectUri,
    state,
  });

  return new ApiResponse(res, 201, "User created successfully", response);
};

export const signin = async (req: Request, res: Response) => {
  const payload = {
    ...req.body,
    ...getAuthorizationPayload(req),
  };
  const result = await userLogin.safeParseAsync(payload);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { clientId, email, password, redirectUri, state } = result.data;
  const response = await signinService(email, password, {
    clientId,
    redirectUri,
    state,
  });

  if (!response) {
    throw new ApiError(401, "User Login failed");
  }

  return new ApiResponse(
    res,
    200,
    "Authorization code generated successfully",
    response,
  );
};

export const token = async (req: Request, res: Response) => {
  const body = getBody(req);
  const payload = {
    ...body,
    clientId: getRequestValue(body.clientId) ?? getRequestValue(body.client_id),
    clientSecret:
      getRequestValue(body.clientSecret) ?? getRequestValue(body.client_secret),
    redirectUri:
      getRequestValue(body.redirectUri) ?? getRequestValue(body.redirect_uri),
  };
  const result = await tokenExchange.safeParseAsync(payload);

  if (!result.success) {
    console.log(result.error);
    throw new ApiError(400, "Validation Error");
  }

  const { clientId, clientSecret, code, redirectUri } = result.data;
  const response = await exchangeAuthorizationCodeService(
    code,
    clientId,
    clientSecret,
    redirectUri,
  );

  return new ApiResponse(res, 200, "Tokens generated successfully", response);
};

export const userinfo = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(401, "Invalid access token");
  }

  const response = await userInfoService(userId);
  return new ApiResponse(res, 200, "User fetched successfully", response);
};

export const certs = (_: Request, res: Response) => {
  const publicKeyPath = process.env.PUBLIC_KEY_PATH
    ? path.resolve(process.cwd(), process.env.PUBLIC_KEY_PATH)
    : path.resolve(process.cwd(), "cert", "public.pem");

  const publicKey = fs.readFileSync(publicKeyPath, "utf8");
  const jwk = createPublicKey(publicKey).export({
    format: "jwk",
  }) as JsonWebKey;

  return res.status(200).json({
    keys: [
      {
        ...jwk,
        use: "sig",
        alg: "RS256",
        kid: "auth-service-rs256",
      },
    ],
  });
};

export const openIdConfig = (req: Request, res: Response) => {
  const baseURL = `${req.protocol}://${req.get("host") ?? "localhost:8000"}`;
  res.status(200).json({
    issuer: baseURL,
    authorization_endpoint: `${baseURL}/api/auth/signin`,
    token_endpoint: `${baseURL}/api/auth/token`,
    userinfo_endpoint: `${baseURL}/api/auth/userinfo`,
    jwks_uri: `${baseURL}/api/auth/certs`,
    registration_endpoint: `${baseURL}/api/auth/client/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  });
};
