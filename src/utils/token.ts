import jwt from "jsonwebtoken";

export function generateAccessToken(claims: jwt.JwtPayload): string {
  return jwt.sign(claims, process.env.PRIVATE_KEY!, {
    algorithm: "RS256",
    expiresIn: "1h",
  });
}

export function generateRefreshToken(claims: jwt.JwtPayload): string {
  return jwt.sign(claims, process.env.PRIVATE_KEY!, {
    algorithm: "RS256",
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, process.env.PUBLIC_KEY!) as jwt.JwtPayload;
}