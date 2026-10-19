import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { finalizeAttendanceSession } from "@/modules/attendance/service";
export const runtime="nodejs";
export async function POST(request:Request,context:RouteContext<"/api/v1/attendance/sessions/[id]/finalize">){try{const p=await authenticate(request);requirePermission(p,"attendance:sessions:write");const{id}=await context.params;return success(request,await finalizeAttendanceSession(requireTenant(p),p.userId,id));}catch(e){return problem(request,e);}}
