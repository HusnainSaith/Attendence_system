import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { transferStudentDto } from "@/modules/people/dto";
import { transferStudent } from "@/modules/people/student-service";

export const runtime="nodejs";
export async function POST(request:Request,context:RouteContext<"/api/v1/students/[id]/transfers">):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"enrollments:write");const {id}=await context.params;return success(request,await transferStudent(requireTenant(principal),principal.userId,id,transferStudentDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
