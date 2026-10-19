import { problem } from "@/common/http/response";
import { resetPasswordDto } from "@/modules/auth/dto";
import { resetPassword } from "@/modules/auth/workflows";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{ try{ const input=resetPasswordDto.parse(await request.json()); await resetPassword(input.token,input.password); return new Response(null,{status:204}); }catch(error){ return problem(request,error); } }
