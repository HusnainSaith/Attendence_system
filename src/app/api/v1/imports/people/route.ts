import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { createPeopleImport } from "@/modules/imports/people-import-service";
import { createPeopleImportDto } from "@/modules/people/dto";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const principal = await authenticate(request);
    requirePermission(principal, "imports:write");
    return success(request, await createPeopleImport(requireTenant(principal), principal.userId, createPeopleImportDto.parse(await request.json())), 201);
  } catch (error) { return problem(request, error); }
}
