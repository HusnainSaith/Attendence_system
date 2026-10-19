import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { biometricEnrollmentDto, biometricProfileQueryDto } from "@/modules/biometric/dto";
import { enrollBiometric, listBiometricProfiles } from "@/modules/biometric/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "biometric:enroll"); return success(request, await enrollBiometric(requireTenant(principal), principal.userId, biometricEnrollmentDto.parse(await request.json())), 201); }
  catch (error) { return problem(request, error); }
}
export async function GET(request: Request): Promise<Response> {
  try { const principal = await authenticate(request); requirePermission(principal, "biometric:read"); const query = biometricProfileQueryDto.parse(Object.fromEntries(new URL(request.url).searchParams)); return success(request, await listBiometricProfiles(requireTenant(principal), query)); }
  catch (error) { return problem(request, error); }
}
