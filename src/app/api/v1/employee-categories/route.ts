import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { employeeCategoryDto } from "@/modules/people/dto";
import { createCategory,listEmployeeCategories } from "@/modules/people/employee-service";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:write");return success(request,await createCategory(requireTenant(principal),employeeCategoryDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
export async function GET(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:read");return success(request,await listEmployeeCategories(requireTenant(principal)));}catch(error){return problem(request,error);}}
