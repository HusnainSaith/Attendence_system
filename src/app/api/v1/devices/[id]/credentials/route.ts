import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { deviceCredentialDto } from "@/modules/biometric/dto";
import { addDeviceCredential } from "@/modules/biometric/service";

export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/v1/devices/[id]/credentials">): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "devices:write"); const { id } = await context.params; return success(request, await addDeviceCredential(requireTenant(principal), principal.userId, id, deviceCredentialDto.parse(await request.json())), 201); }
  catch (error) { return problem(request, error); }
}
