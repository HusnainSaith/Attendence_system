import { authenticate,requirePermission,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { shiftDto } from "@/modules/academics/dto";
import { createShift,listShifts } from "@/modules/people/employee-service";
import { uuid } from "@/common/dto/primitives";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:write");return success(request,await createShift(requireTenant(principal),shiftDto.parse(await request.json())),201);}catch(error){return problem(request,error);}}
export async function GET(request:Request):Promise<Response>{try{const principal=await authenticate(request);requirePermission(principal,"employees:read");const raw=new URL(request.url).searchParams.get("campusId");const campusId=raw?uuid.parse(raw):undefined;return success(request,await listShifts(requireTenant(principal),campusId));}catch(error){return problem(request,error);}}
