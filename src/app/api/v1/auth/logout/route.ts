import { problem } from "@/common/http/response";
import { env } from "@/config/env";
import { clearRefreshCookie, readCookie } from "@/modules/auth/cookies";
import { logout } from "@/modules/auth/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const token = readCookie(request, env().REFRESH_COOKIE_NAME);
    if (token) await logout(token);
    const response = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    clearRefreshCookie(response);
    return response;
  } catch (error) { return problem(request, error); }
}
