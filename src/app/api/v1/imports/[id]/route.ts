import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { getPeopleImport } from "@/modules/imports/people-import-service";

export const runtime = "nodejs";
export async function GET(request: Request, context: RouteContext<"/api/v1/imports/[id]">): Promise<Response> {
  try {
    const principal = await authenticate(request);
    requirePermission(principal, "imports:read");
    const { id } = await context.params;
    return success(request, await getPeopleImport(requireTenant(principal), id));
  } catch (error) { return problem(request, error); }
}
