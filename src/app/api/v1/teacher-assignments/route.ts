import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { teacherAssignmentDto } from "@/modules/people/dto";
import { createTeacherAssignment,listTeacherAssignments } from "@/modules/people/employee-service";
import { uuid } from "@/common/dto/primitives";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:write");return success(request,await createTeacherAssignment(requireTenant(principal),principal.userId,teacherAssignmentDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
export async function GET(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:read");const raw=new URL(request.url).searchParams.get("employeeId");const employeeId=raw?uuid.parse(raw):undefined;return success(request,await listTeacherAssignments(requireTenant(principal),employeeId));}catch(error){return problem(request,error);}}
