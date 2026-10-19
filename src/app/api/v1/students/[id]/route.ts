import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { updateStudentDto } from "@/modules/people/dto";
import { getStudent,updateStudent } from "@/modules/people/student-service";

export const runtime="nodejs";
export async function GET(request:Request,context:RouteContext<"/api/v1/students/[id]">):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"students:read");const {id}=await context.params;return success(request,await getStudent(requireTenant(principal),id));}catch(error){return problem(request,error);}}
export async function PATCH(request:Request,context:RouteContext<"/api/v1/students/[id]">):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"students:write");const {id}=await context.params;return success(request,await updateStudent(requireTenant(principal),principal.userId,id,updateStudentDto.parse(await request.json())));}catch(error){return problem(request,error);}}
