import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem } from "@/common/http/response";
import { unlinkGuardian } from "@/modules/people/guardian-service";

export const runtime="nodejs";
export async function DELETE(request:Request,context:RouteContext<"/api/v1/students/[id]/guardians/[guardianId]">):Promise<Response>{try{const p=await authenticate(request);requirePermission(p,"guardians:write");const {id,guardianId}=await context.params;await unlinkGuardian(requireTenant(p),p.userId,id,guardianId);return new Response(null,{status:204});}catch(error){return problem(request,error);}}
