import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { consentWithdrawDto } from "@/modules/biometric/dto";
import { withdrawConsent } from "@/modules/biometric/service";

export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/v1/consents/[id]/withdraw">): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "consent:write"); const { id } = await context.params; const body = consentWithdrawDto.parse(await request.json()); return success(request, await withdrawConsent(requireTenant(principal), principal.userId, id, body.reason)); }
  catch (error) { return problem(request, error); }
}
