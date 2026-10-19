import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { updateEmployeeDto } from "@/modules/people/dto";
import { getEmployee,updateEmployee } from "@/modules/people/employee-service";

export const runtime="nodejs";
export async function GET(request:Request,context:RouteContext<"/api/v1/employees/[id]">):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:read");const {id}=await context.params;return success(request,await getEmployee(requireTenant(principal),id));}catch(error){return problem(request,error);}}
export async function PATCH(request:Request,context:RouteContext<"/api/v1/employees/[id]">):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:write");const {id}=await context.params;return success(request,await updateEmployee(requireTenant(principal),principal.userId,id,updateEmployeeDto.parse(await request.json())));}catch(error){return problem(request,error);}}
