import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { linkGuardianDto } from "@/modules/people/dto";
import { linkGuardian } from "@/modules/people/guardian-service";

export const runtime="nodejs";
export async function POST(request:Request,context:RouteContext<"/api/v1/students/[id]/guardians">):Promise<Response>{try{const p=await authenticate(request);requirePermission(p,"guardians:write");const {id}=await context.params;return success(request,await linkGuardian(requireTenant(p),p.userId,id,linkGuardianDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
