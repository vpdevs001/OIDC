import type { Request, Response } from "express";
import { randomBytes, createHmac } from "node:crypto";
import { signinPayloadModel, signupPayloadModel } from "./models.js";
import { db } from "../../db/index.js";
import { usersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import type { UserTokenPayload } from "./utils/token.js";

const authCodes = new Map<string, any>();

class AuthenticationController {
  public async handleSignup(req: Request, res: Response) {
    const validationResult = await signupPayloadModel.safeParseAsync(req.body);

    if (validationResult.error)
      return res.status(400).json({
        message: "body validation failed",
        error: validationResult.error.issues,
      });

    const { firstName, lastName, email, password } = validationResult.data;

    const userEmailResult = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (userEmailResult.length > 0)
      return res.status(400).json({
        error: "duplicate entry",
        message: `user with email ${email} already exists`,
      });

    const salt = randomBytes(32).toString("hex");
    const hash = createHmac("sha256", salt).update(password).digest("hex");

    const [result] = await db
      .insert(usersTable)
      .values({
        firstName,
        lastName,
        email,
        password: hash,
        salt,
      })
      .returning({ id: usersTable.id });

    return res.status(201).json({
      message: "user has been created successfully",
      data: { id: result?.id },
    });
  }

  public async handleSignin(req: Request, res: Response) {
    const validationResult = await signinPayloadModel.safeParseAsync(req.body);

    if (validationResult.error)
      return res.status(400).json({
        message: "body validation failed",
        error: validationResult.error.issues,
      });

    const { email, password } = validationResult.data;

    const [userSelect] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (!userSelect)
      return res
        .status(404)
        .json({ message: `user with email ${email} does not exists` });

    const salt = userSelect.salt!;
    const hash = createHmac("sha256", salt).update(password).digest("hex");

    if (userSelect.password !== hash)
      return res
        .status(400)
        .json({ message: `email or password is incorrect` });

    const code = randomBytes(16).toString("hex");

    authCodes.set(code, {
      id: userSelect.id,
      firstName: userSelect.firstName,
      lastName: userSelect.lastName,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return res.json({ code });
  }

  public async handleMe(req: Request, res: Response) {
    // @ts-ignore
    const { id } = req.user! as UserTokenPayload;

    const [userResult] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));

    return res.json({
      firstName: userResult?.firstName,
      lastName: userResult?.lastName,
      email: userResult?.email,
    });
  }

  public async handleToken(req: Request, res: Response) {
    const { code } = req.body;

    if (!authCodes.has(code)) {
      return res.status(400).json({ error: "Invalid code" });
    }

    const user = authCodes.get(code);

    if (Date.now() > user.expiresAt) {
      authCodes.delete(code);
      return res.status(400).json({ error: "Code expired" });
    }

    authCodes.delete(code);

    const issuer = `${req.protocol}://${req.get("host")}`;

    const id_token = jwt.sign(
      {
        sub: user.id,
        name: `${user.firstName} ${user.lastName}`,
        iss: issuer,
        aud: "client_id",
        iat: Math.floor(Date.now() / 1000),
      },
      "secret",
      { expiresIn: "1h" },
    );

    const access_token = jwt.sign({ id: user.id }, "secret", {
      expiresIn: "1h",
    });

    return res.json({
      access_token,
      id_token,
      token_type: "Bearer",
    });
  }

  public async JWKSHandler(req: Request, res: Response) {
    return res.json({
      keys: []
    })
  }
}

export default AuthenticationController;
