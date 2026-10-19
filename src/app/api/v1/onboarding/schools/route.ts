import { authenticate,requirePermission } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { schoolOnboardingDto } from "@/modules/onboarding/dto";
import { onboardSchool } from "@/modules/onboarding/service";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{ try{ const principal=await authenticate(request); requirePermission(principal,"schools:create"); return success(request,await onboardSchool(principal.userId,schoolOnboardingDto.parse(await request.json())),201); }catch(error){ return problem(request,error); } }
