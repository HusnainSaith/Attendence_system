import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { classInput } from "@/modules/directory/schemas";
import { createClass } from "@/modules/directory/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const principal = await authenticate(request); requirePermission(principal, "academics:write");
    return success(request, await createClass(requireTenant(principal), classInput.parse(await request.json())), 201);
  } catch (error) { return problem(request, error); }
}
