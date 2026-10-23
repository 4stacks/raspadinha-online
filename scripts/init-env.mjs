import { createHmac, randomBytes } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const examplePath = resolve(root, ".env.example");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  console.error("A .env já existe; ela não será sobrescrita.");
  process.exit(1);
}

copyFileSync(examplePath, envPath);

const hex = (bytes) => randomBytes(bytes).toString("hex");
const base64 = (bytes) => randomBytes(bytes).toString("base64");
const base64Url = (value) => Buffer.from(value).toString("base64url");
const jwtSecret = base64(48);
const issuedAt = Math.floor(Date.now() / 1000);
const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function signedKey(role) {
  const payload = base64Url(
    JSON.stringify({
      role,
      iss: "supabase",
      iat: issuedAt,
      exp: issuedAt + 5 * 365 * 24 * 60 * 60,
    }),
  );
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(input)
    .digest("base64url");
  return `${input}.${signature}`;
}

const values = {
  POSTGRES_PASSWORD: hex(32),
  JWT_SECRET: jwtSecret,
  ANON_KEY: signedKey("anon"),
  SERVICE_ROLE_KEY: signedKey("service_role"),
  DASHBOARD_PASSWORD: hex(24),
  SECRET_KEY_BASE: base64(48),
  REALTIME_DB_ENC_KEY: hex(8),
  VAULT_ENC_KEY: hex(16),
  PG_META_CRYPTO_KEY: base64(32),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: base64(32),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: base64(32),
  S3_PROTOCOL_ACCESS_KEY_ID: hex(16),
  S3_PROTOCOL_ACCESS_KEY_SECRET: hex(32),
  MINIO_ROOT_PASSWORD: hex(24),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: signedKey("anon"),
};

let contents = readFileSync(envPath, "utf8");
for (const [key, value] of Object.entries(values)) {
  contents = contents.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
}
writeFileSync(envPath, contents, { mode: 0o600 });
chmodSync(envPath, 0o600);
console.info("Arquivo .env criado com secrets aleatórios (permissão 0600).");
