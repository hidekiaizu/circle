import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_LENGTH = 64;

export function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validUsername(value: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

export function validPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 128;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, HASH_LENGTH)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [method, saltHex, keyHex] = stored.split(":");
  if (method !== "scrypt" || !saltHex || !keyHex || keyHex.length !== HASH_LENGTH * 2) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), HASH_LENGTH)) as Buffer;
  return timingSafeEqual(actual, expected);
}
