import { authenticate, requirePermission } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { schoolInput } from "@/modules/directory/schemas";
import { createSchool } from "@/modules/directory/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const principal = await authenticate(request);
    requirePermission(principal, "schools:create");
    return success(request, await createSchool(schoolInput.parse(await request.json())), 201);
  } catch (error) { return problem(request, error); }
}
