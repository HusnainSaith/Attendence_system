import { problem } from "@/common/http/response";
import { acceptInvitationDto } from "@/modules/auth/dto";
import { acceptInvitation } from "@/modules/auth/workflows";

export const runtime="nodejs";
export async function POST(request:Request):Promise<Response>{ try{ await acceptInvitation(acceptInvitationDto.parse(await request.json())); return new Response(null,{status:204}); }catch(error){ return problem(request,error); } }
