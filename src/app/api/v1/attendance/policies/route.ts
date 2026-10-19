import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { attendancePolicyDto } from "@/modules/attendance/schemas";
import { createAttendancePolicy,listAttendancePolicies } from "@/modules/attendance/service";
export const runtime="nodejs";
export async function POST(request:Request){try{const p=await authenticate(request);requirePermission(p,"attendance:policies:write");return success(request,await createAttendancePolicy(requireTenant(p),attendancePolicyDto.parse(await request.json())),201);}catch(e){return problem(request,e);}}
export async function GET(request:Request){try{const p=await authenticate(request);requirePermission(p,"attendance:read");return success(request,await listAttendancePolicies(requireTenant(p)));}catch(e){return problem(request,e);}}
