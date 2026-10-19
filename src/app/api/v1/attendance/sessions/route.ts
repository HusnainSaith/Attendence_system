import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { attendanceSessionDto,attendanceSessionQueryDto } from "@/modules/attendance/schemas";
import { createAttendanceSession,listAttendanceSessions } from "@/modules/attendance/service";
export const runtime="nodejs";
export async function POST(request:Request){try{const p=await authenticate(request);requirePermission(p,"attendance:sessions:write");return success(request,await createAttendanceSession(requireTenant(p),p.userId,attendanceSessionDto.parse(await request.json())),201);}catch(e){return problem(request,e);}}
export async function GET(request:Request){try{const p=await authenticate(request);requirePermission(p,"attendance:read");const q=attendanceSessionQueryDto.parse(Object.fromEntries(new URL(request.url).searchParams));return success(request,await listAttendanceSessions(requireTenant(p),q));}catch(e){return problem(request,e);}}
