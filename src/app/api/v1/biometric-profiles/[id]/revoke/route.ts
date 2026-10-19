import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { biometricRevokeDto } from "@/modules/biometric/dto";
import { revokeBiometric } from "@/modules/biometric/service";

export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/v1/biometric-profiles/[id]/revoke">): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "biometric:revoke"); const { id } = await context.params; return success(request, await revokeBiometric(requireTenant(principal), principal.userId, id, biometricRevokeDto.parse(await request.json()))); }
  catch (error) { return problem(request, error); }
}
