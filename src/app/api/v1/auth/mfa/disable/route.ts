import { authenticate } from "@/common/auth/principal";
import { problem } from "@/common/http/response";
import { disableMfaDto } from "@/modules/auth/dto";
import { disableMfa } from "@/modules/auth/workflows";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{ try{ const principal=await authenticate(request); const input=disableMfaDto.parse(await request.json()); await disableMfa(principal.userId,input.password,input.code); return new Response(null,{status:204}); }catch(error){ return problem(request,error); } }
