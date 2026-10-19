import { env } from "@/config/env";

export function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
}

export function setRefreshCookie(response: Response, token: string): void {
  const secure = env().NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${env().REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${env().REFRESH_TOKEN_TTL_SECONDS}${secure}`);
}

export function clearRefreshCookie(response: Response): void {
  const secure = env().NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${env().REFRESH_COOKIE_NAME}=; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
