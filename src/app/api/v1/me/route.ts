import { authenticate } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  try { return success(request, await authenticate(request)); }
  catch (error) { return problem(request, error); }
}
