import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { listStudentEnrollments } from "@/modules/people/enrollment-service";

export const runtime = "nodejs";
export async function GET(request: Request, context: RouteContext<"/api/v1/students/[id]/enrollments">): Promise<Response> {
  try {
    const principal = await authenticate(request);
    requirePermission(principal, "enrollments:read");
    const { id } = await context.params;
    return success(request, await listStudentEnrollments(requireTenant(principal), id));
  } catch (error) { return problem(request, error); }
}
