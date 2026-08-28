import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.env.AUTH_PASSWORD_TO_HASH;
if (!password || password.length < 8) {
  console.error("Defina AUTH_PASSWORD_TO_HASH com uma senha de pelo menos 8 caracteres.");
  process.exit(1);
}

const iterations = 210_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
console.log(`pbkdf2-sha256$${iterations}$${salt.toString("hex")}$${hash.toString("hex")}`);
