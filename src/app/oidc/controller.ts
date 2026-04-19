import type { Request, Response } from "express";

class OIDCController {
  public async handleOpenIdConfiguration(req: Request, res: Response) {
    const issuer = `${req.protocol}://${req.get("host")}`;

    return res.json({
      issuer,
      authorization_endpoint: `${issuer}/auth/sign-in`,
      token_endpoint: `${issuer}/auth/token`,
      userinfo_endpoint: `${issuer}/auth/me`,
      jwks_uri: `${issuer}/auth/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["HS256"],
    });
  }
}
export default OIDCController;

