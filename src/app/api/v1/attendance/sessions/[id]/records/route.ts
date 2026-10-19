import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { manualAttendanceDto } from "@/modules/attendance/schemas";
import { listAttendanceRecords,markAttendanceManually } from "@/modules/attendance/service";
export const runtime="nodejs";
export async function GET(request:Request,context:RouteContext<"/api/v1/attendance/sessions/[id]/records">){try{const p=await authenticate(request);requirePermission(p,"attendance:read");const{id}=await context.params;return success(request,await listAttendanceRecords(requireTenant(p),id));}catch(e){return problem(request,e);}}
export async function POST(request:Request,context:RouteContext<"/api/v1/attendance/sessions/[id]/records">){try{const p=await authenticate(request);requirePermission(p,"attendance:manual");const{id}=await context.params;return success(request,await markAttendanceManually(requireTenant(p),p.userId,id,manualAttendanceDto.parse(await request.json())),201);}catch(e){return problem(request,e);}}
