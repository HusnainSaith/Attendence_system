import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { consentDto } from "@/modules/biometric/dto";
import { grantConsent } from "@/modules/biometric/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "consent:write"); return success(request, await grantConsent(requireTenant(principal), principal.userId, consentDto.parse(await request.json())), 201); }
  catch (error) { return problem(request, error); }
}
