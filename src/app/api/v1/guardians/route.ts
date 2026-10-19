import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { createGuardianDto,guardianListQueryDto } from "@/modules/people/dto";
import { createGuardian,listGuardians } from "@/modules/people/guardian-service";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{try{const p=await authenticate(request);requirePermission(p,"guardians:write");return success(request,await createGuardian(requireTenant(p),p.userId,createGuardianDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
export async function GET(request:Request):Promise<Response>{try{const p=await authenticate(request);requirePermission(p,"guardians:read");const query=Object.fromEntries(new URL(request.url).searchParams);return success(request,await listGuardians(requireTenant(p),guardianListQueryDto.parse(query)));}catch(error){return problem(request,error);}}
