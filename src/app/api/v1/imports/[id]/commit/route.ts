import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { commitPeopleImport } from "@/modules/imports/people-import-service";

export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/v1/imports/[id]/commit">): Promise<Response> {
  try {
    const principal = await authenticate(request);
    requirePermission(principal, "imports:write");
    const { id } = await context.params;
    return success(request, await commitPeopleImport(requireTenant(principal), principal.userId, id));
  } catch (error) { return problem(request, error); }
}
