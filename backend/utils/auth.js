import {
  randomBytes,
  createHmac,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { fail } from "./validation.js";
const scrypt = promisify(scryptCallback);

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function verifyToken(token, secret) {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) throw new Error("Invalid token");
  const signature = Buffer.from(parts[2], "base64url");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  if (header.alg !== "HS256") throw new Error("Invalid token");
  const actual = createHmac("sha256", secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  if (signature.length !== actual.length || !timingSafeEqual(signature, actual))
    throw new Error("Invalid token");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (payload.iss !== "teacollector" || !payload.sub || payload.exp <= Date.now() / 1000)
    throw new Error("Expired token");
  return payload;
}
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    fail("Password must contain 8–128 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password, stored) {
  if (typeof password !== "string" || password.length > 128 || !stored)
    return false;
  const [salt, saved] = stored.split(":");
  const expected = Buffer.from(saved, "hex");
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}
export function signToken(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: user.id, iss: "teacollector", iat: now, exp: now + 8 * 60 * 60 });
  const content = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(content).digest("base64url");
  return `${content}.${signature}`;
}
export function authenticate(store, secret) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : "";
    let id;
    try {
      id = verifyToken(token, secret).sub;
    } catch {
      return res.status(401).json({ error: "Please sign in again." });
    }
    const user = await store.one("users", { id });
    if (!user || !user.active)
      return res.status(401).json({ error: "This account is unavailable." });
    req.user = user;
    next();
  };
}
export function role(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role))
      return res
        .status(403)
        .json({ error: "You do not have permission for this action." });
    next();
  };
}
