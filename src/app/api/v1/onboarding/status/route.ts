import { authenticate,requireTenant } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { onboardingStatus } from "@/modules/onboarding/service";

export const runtime="nodejs";
export async function GET(request:Request):Promise<Response>{ try{ const principal=await authenticate(request); return success(request,await onboardingStatus(requireTenant(principal))); }catch(error){ return problem(request,error); } }
