import { authenticate } from "@/common/auth/principal";
import { problem,success } from "@/common/http/response";
import { verifyMfaDto } from "@/modules/auth/dto";
import { confirmMfa } from "@/modules/auth/workflows";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{ try{ const principal=await authenticate(request); const {code}=verifyMfaDto.parse(await request.json()); return success(request,{recoveryCodes:await confirmMfa(principal.userId,principal.sessionId,code)}); }catch(error){ return problem(request,error); } }
