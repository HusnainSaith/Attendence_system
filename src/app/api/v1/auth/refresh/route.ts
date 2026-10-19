import { AppError } from "@/common/errors/app-error";
import { problem, success } from "@/common/http/response";
import { env } from "@/config/env";
import { readCookie, setRefreshCookie } from "@/modules/auth/cookies";
import { refreshDto } from "@/modules/auth/dto";
import { rotateRefreshToken } from "@/modules/auth/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const body = refreshDto.parse(await request.json().catch(() => ({})));
    const token = body.refreshToken ?? readCookie(request, env().REFRESH_COOKIE_NAME);
    if (!token) throw new AppError("AUTH_REQUIRED", 401, "Refresh token is required");
    const result = await rotateRefreshToken(token, body.deviceFingerprint);
    const response = success(request, { accessToken: result.accessToken, expiresIn: result.expiresIn, refreshExpiresAt: result.refreshExpiresAt });
    const { refreshToken } = result;
    setRefreshCookie(response, refreshToken);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return problem(request, error); }
}
