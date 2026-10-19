import { randomBytes } from "node:crypto";
import { AppError } from "@/common/errors/app-error";
import { env } from "@/config/env";
import { withDatabaseContext } from "@/database/tenant-transaction";
import { sendEmail } from "@/integrations/email/mailer";
import { hashOpaqueToken } from "@/modules/auth/tokens";
import type { SchoolOnboardingDto } from "./dto";

type OnboardingResult = { schoolId:string; campusId:string; academicYearId:string; policyId:string; principalInvitationId:string; classes:Array<{id:string;code:string;sections:Array<{id:string;code:string}>}> };

export async function onboardSchool(actorId:string,input:SchoolOnboardingDto):Promise<OnboardingResult>{
  const invitationToken=randomBytes(48).toString("base64url");
  let result:OnboardingResult;
  try{
    result=await withDatabaseContext({isSuperAdmin:true},async(manager)=>{
      if(input.school.planId){ const [plan]=await manager.query(`SELECT id FROM plans WHERE id=$1 AND status='ACTIVE'`,[input.school.planId]); if(!plan) throw new AppError("PLAN_NOT_AVAILABLE",422,"Selected plan is not available"); }
      const [school]=await manager.query(`INSERT INTO schools(slug,name,status,timezone,locale,plan_id) VALUES($1,$2,'ACTIVE',$3,$4,$5) RETURNING id`,[input.school.slug,input.school.name,input.school.timezone,input.school.locale,input.school.planId??null]);
      if(input.school.planId) await manager.query(`INSERT INTO subscriptions(tenant_id,plan_id,status,starts_at) VALUES($1,$2,'ACTIVE',now())`,[school.id,input.school.planId]);
      const [campus]=await manager.query(`INSERT INTO campuses(tenant_id,code,name,address,status) VALUES($1,$2,$3,$4,'ACTIVE') RETURNING id`,[school.id,input.campus.code,input.campus.name,JSON.stringify(input.campus.address)]);
      const [year]=await manager.query(`INSERT INTO academic_years(tenant_id,name,starts_on,ends_on,status,is_default) VALUES($1,$2,$3,$4,'ACTIVE',true) RETURNING id`,[school.id,input.academicYear.name,input.academicYear.startsOn,input.academicYear.endsOn]);
      const createdClasses:OnboardingResult["classes"]=[];
      for(const item of input.classes){
        const [created]=await manager.query(`INSERT INTO classes(tenant_id,academic_year_id,code,name,level,status) VALUES($1,$2,$3,$4,$5,'ACTIVE') RETURNING id`,[school.id,year.id,item.code,item.name,item.level??null]);
        const sections:Array<{id:string;code:string}>=[];
        for(const section of item.sections){ const [row]=await manager.query(`INSERT INTO sections(tenant_id,class_id,code,name,capacity,status) VALUES($1,$2,$3,$4,$5,'ACTIVE') RETURNING id`,[school.id,created.id,section.code,section.name,section.capacity??null]); sections.push({id:row.id,code:section.code}); }
        createdClasses.push({id:created.id,code:item.code,sections});
      }
      const rules={lateAfterMinutes:input.attendancePolicy.lateAfterMinutes,absentAfterMinutes:input.attendancePolicy.absentAfterMinutes,debounceSeconds:input.attendancePolicy.debounceSeconds,requireCheckOut:input.attendancePolicy.requireCheckOut};
      const [policy]=await manager.query(`INSERT INTO attendance_policies(tenant_id,campus_id,name,version,timezone,rules,effective_from,effective_to,status) VALUES($1,$2,$3,1,$4,$5,$6,$7,'ACTIVE') RETURNING id`,[school.id,campus.id,input.attendancePolicy.name,input.school.timezone,JSON.stringify(rules),input.academicYear.startsOn,input.academicYear.endsOn]);
      const [ownerRole]=await manager.query(`SELECT id FROM roles WHERE tenant_id IS NULL AND code='SCHOOL_OWNER' AND is_system=true`); if(!ownerRole) throw new AppError("IAM_NOT_SEEDED",503,"System roles have not been seeded");
      const [invitation]=await manager.query(`INSERT INTO user_invitations(tenant_id,email,role_id,campus_id,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '48 hours') RETURNING id`,[school.id,input.principal.email.toLowerCase(),ownerRole.id,campus.id,hashOpaqueToken(invitationToken),actorId]);
      await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,effective_role,action,resource_type,resource_id,result,correlation_id) VALUES($1,'USER',$2,'SUPER_ADMIN','SCHOOL_ONBOARDED','SCHOOL',$1,'SUCCESS',gen_random_uuid())`,[school.id,actorId]);
      return {schoolId:school.id,campusId:campus.id,academicYearId:year.id,policyId:policy.id,principalInvitationId:invitation.id,classes:createdClasses};
    },"SERIALIZABLE");
  }catch(error){
    if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="23505") throw new AppError("ONBOARDING_CONFLICT",409,"A school, campus, class, section, or invitation already exists");
    throw error;
  }
  await sendEmail({to:input.principal.email,subject:`Welcome to ${input.school.name}`,text:`Hello ${input.principal.firstName},\n\nAccept your EduPresence principal invitation: ${env().APP_BASE_URL}/accept-invitation?token=${encodeURIComponent(invitationToken)}\nThis link expires in 48 hours.`});
  return result;
}

export async function onboardingStatus(tenantId:string){
  return withDatabaseContext({tenantId},async(manager)=>{
    const [[counts],[school]]=await Promise.all([
      manager.query(`SELECT (SELECT count(*)::int FROM campuses WHERE tenant_id=$1) campuses,(SELECT count(*)::int FROM academic_years WHERE tenant_id=$1 AND status='ACTIVE') academic_years,(SELECT count(*)::int FROM classes WHERE tenant_id=$1 AND status='ACTIVE') classes,(SELECT count(*)::int FROM sections WHERE tenant_id=$1 AND status='ACTIVE') sections,(SELECT count(*)::int FROM attendance_policies WHERE tenant_id=$1 AND status='ACTIVE') policies,(SELECT count(*)::int FROM biometric_devices WHERE tenant_id=$1 AND status='ACTIVE') devices`,[tenantId]),
      manager.query(`SELECT id,name,status,timezone FROM schools WHERE id=$1`,[tenantId]),
    ]);
    return {school,counts,readyForPeople:counts.campuses>0&&counts.academic_years>0&&counts.classes>0&&counts.sections>0&&counts.policies>0,readyForBiometricAttendance:counts.devices>0};
  });
}
