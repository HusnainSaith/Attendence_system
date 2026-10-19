import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { employeeDto,employeeListQueryDto } from "@/modules/people/dto";
import { createEmployee,listEmployees } from "@/modules/people/employee-service";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:write");return success(request,await createEmployee(requireTenant(principal),principal.userId,employeeDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
export async function GET(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:read");const query=Object.fromEntries(new URL(request.url).searchParams);return success(request,await listEmployees(requireTenant(principal),employeeListQueryDto.parse(query)));}catch(error){return problem(request,error);}}
