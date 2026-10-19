import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { createStudentDto,studentListQueryDto } from "@/modules/people/dto";
import { admitStudent,listStudents } from "@/modules/people/student-service";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"students:write");return success(request,await admitStudent(requireTenant(principal),principal.userId,createStudentDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
export async function GET(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"students:read");const query=Object.fromEntries(new URL(request.url).searchParams);return success(request,await listStudents(requireTenant(principal),studentListQueryDto.parse(query)));}catch(error){return problem(request,error);}}
