import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { promoteStudentsDto } from "@/modules/people/dto";
import { previewPromotion } from "@/modules/people/enrollment-service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const principal = await authenticate(request);
    requirePermission(principal, "enrollments:write");
    return success(request, await previewPromotion(requireTenant(principal), promoteStudentsDto.parse(await request.json())));
  } catch (error) { return problem(request, error); }
}
