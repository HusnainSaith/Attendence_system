import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { updateGuardianDto } from "@/modules/people/dto";
import { getGuardian,updateGuardian } from "@/modules/people/guardian-service";

export const runtime="nodejs";
export async function GET(request:Request,context:RouteContext<"/api/v1/guardians/[id]">):Promise<Response>{try{const p=await authenticate(request);requirePermission(p,"guardians:read");const {id}=await context.params;return success(request,await getGuardian(requireTenant(p),id));}catch(error){return problem(request,error);}}
export async function PATCH(request:Request,context:RouteContext<"/api/v1/guardians/[id]">):Promise<Response>{try{const p=await authenticate(request);requirePermission(p,"guardians:write");const {id}=await context.params;return success(request,await updateGuardian(requireTenant(p),p.userId,id,updateGuardianDto.parse(await request.json())));}catch(error){return problem(request,error);}}
