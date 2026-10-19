import { problem } from "@/common/http/response";
import { forgotPasswordDto } from "@/modules/auth/dto";
import { requestPasswordReset } from "@/modules/auth/workflows";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{ try{ const {email}=forgotPasswordDto.parse(await request.json()); await requestPasswordReset(email); return new Response(null,{status:202}); }catch(error){ return problem(request,error); } }
