import { authenticate, requirePermission } from "@/common/auth/principal";
import { problem, success } from "@/common/http/response";
import { inviteUserDto } from "@/modules/auth/dto";
import { inviteUser } from "@/modules/auth/workflows";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try { const principal=await authenticate(request); requirePermission(principal,"iam:users:write"); const input=inviteUserDto.parse(await request.json()); await inviteUser(principal.userId,principal.tenantId,input); return success(request,{status:"INVITED"},202); }
  catch(error){ return problem(request,error); }
}
