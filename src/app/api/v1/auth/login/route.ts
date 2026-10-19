import { problem, success } from "@/common/http/response";
import { loginDto } from "@/modules/auth/dto";
import { setRefreshCookie } from "@/modules/auth/cookies";
import { login } from "@/modules/auth/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const input = loginDto.parse(await request.json());
    const result = await login(input, { ip: request.headers.get("x-real-ip") ?? undefined, userAgent: request.headers.get("user-agent") ?? undefined });
    const { refreshToken, ...body } = result;
    const response = success(request, body);
    setRefreshCookie(response, refreshToken);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return problem(request, error); }
}
