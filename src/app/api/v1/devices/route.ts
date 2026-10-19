import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { deviceDto } from "@/modules/biometric/dto";
import { listDevices, registerDevice } from "@/modules/biometric/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "devices:write"); return success(request, await registerDevice(requireTenant(principal), principal.userId, deviceDto.parse(await request.json())), 201); }
  catch (error) { return problem(request, error); }
}
export async function GET(request: Request): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "devices:health"); return success(request, await listDevices(requireTenant(principal))); }
  catch (error) { return problem(request, error); }
}
