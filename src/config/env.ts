import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(7_776_000).default(2_592_000),
  REFRESH_COOKIE_NAME: z.string().min(1).max(100).default("edupresence_refresh"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  MFA_ENCRYPTION_KEY: z.string().min(43).optional(),
  BIOMETRIC_ENCRYPTION_KEY: z.string().min(43).optional(),
  WORKER_SECRET: z.string().min(32).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.email().default("no-reply@example.test"),
  DEVICE_CLOCK_DRIFT_SECONDS: z.coerce.number().int().positive().default(300),
  DEVICE_SIGNATURE_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Environment = z.infer<typeof schema>;
let cached: Environment | undefined;

export function env(): Environment {
  cached ??= schema.parse(process.env);
  return cached;
}

export function resetEnvForTests(): void {
  cached = undefined;
}
