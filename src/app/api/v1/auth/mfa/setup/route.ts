import { authenticate } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { beginMfaSetup } from "@/modules/auth/workflows";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{ try{ const principal=await authenticate(request); return success(request,await beginMfaSetup(principal.userId),201); }catch(error){ return problem(request,error); } }
