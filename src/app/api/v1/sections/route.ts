import { authenticate, requirePermission, requireTenant } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { sectionInput } from "@/modules/directory/schemas";
import { createSection } from "@/modules/directory/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const principal = await authenticate(request); requirePermission(principal, "academics:write");
    return success(request, await createSection(requireTenant(principal), sectionInput.parse(await request.json())), 201);
  } catch (error) { return problem(request, error); }
}
