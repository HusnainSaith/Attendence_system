import { AppError,conflict,notFound } from "@/common/errors/app-error";
import { withDatabaseContext } from "@/database/tenant-transaction";
import type { EntityManager } from "typeorm";
import type { CreateStudentDto } from "./dto";

type Cursor={createdAt:string;id:string};
const encodeCursor=(value:Cursor)=>Buffer.from(JSON.stringify(value)).toString("base64url");
function decodeCursor(value?:string):Cursor|undefined{ if(!value)return; try{ const parsed=JSON.parse(Buffer.from(value,"base64url").toString("utf8")); if(typeof parsed.createdAt!=="string"||typeof parsed.id!=="string")throw new Error(); return parsed; }catch{ throw new AppError("CURSOR_INVALID",422,"Pagination cursor is invalid"); } }

async function validatePlacement(manager:EntityManager,tenantId:string,input:{academicYearId:string;campusId:string;classId:string;sectionId:string}){
  const [row]=await manager.query(`SELECT s.id FROM sections s JOIN classes c ON c.id=s.class_id AND c.tenant_id=s.tenant_id JOIN academic_years ay ON ay.id=c.academic_year_id AND ay.tenant_id=c.tenant_id JOIN campuses cp ON cp.tenant_id=s.tenant_id WHERE s.id=$1 AND c.id=$2 AND ay.id=$3 AND cp.id=$4 AND s.tenant_id=$5 AND s.status='ACTIVE' AND c.status='ACTIVE'`,[input.sectionId,input.classId,input.academicYearId,input.campusId,tenantId]);
  if(!row)throw new AppError("ACADEMIC_PLACEMENT_INVALID",422,"Campus, academic year, class, and section must be active and belong to the same school");
}

export async function admitStudent(tenantId:string,actorId:string,input:CreateStudentDto){
  try{return await withDatabaseContext({tenantId},async(manager)=>{
    if(input.enrollment)await validatePlacement(manager,tenantId,input.enrollment);
    const [student]=await manager.query(`INSERT INTO students(tenant_id,admission_no,first_name,last_name,date_of_birth,sex,status,joined_on) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7) RETURNING id,admission_no,first_name,last_name,date_of_birth,status`,[tenantId,input.admissionNo,input.firstName,input.lastName,input.dateOfBirth,input.sex??null,input.enrollment?.startsOn??null]);
    let guardianId:string|undefined;
    if(input.guardian){ const [guardian]=await manager.query(`INSERT INTO guardians(tenant_id,first_name,last_name,phone,email,status) VALUES($1,$2,$3,$4,$5,'ACTIVE') RETURNING id`,[tenantId,input.guardian.firstName,input.guardian.lastName,input.guardian.phone??null,input.guardian.email?.toLowerCase()??null]); guardianId=guardian.id; await manager.query(`INSERT INTO student_guardians(tenant_id,student_id,guardian_id,relationship,is_primary,notification_authority) VALUES($1,$2,$3,$4,$5,$6)`,[tenantId,student.id,guardian.id,input.guardian.relationship,input.guardian.isPrimary,input.guardian.notificationAuthority]); }
    let enrollmentId:string|undefined;
    if(input.enrollment){ const [enrollment]=await manager.query(`INSERT INTO enrollments(tenant_id,student_id,academic_year_id,campus_id,class_id,section_id,starts_on,ends_on,status,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE','ADMISSION') RETURNING id`,[tenantId,student.id,input.enrollment.academicYearId,input.enrollment.campusId,input.enrollment.classId,input.enrollment.sectionId,input.enrollment.startsOn,input.enrollment.endsOn??null]); enrollmentId=enrollment.id; }
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,after_hash,result,correlation_id) VALUES($1,'USER',$2,'STUDENT_ADMITTED','STUDENT',$3,encode(digest($4,'sha256'),'hex'),'SUCCESS',gen_random_uuid())`,[tenantId,actorId,student.id,JSON.stringify({admissionNo:input.admissionNo,enrollmentId,guardianId})]);
    return {...student,guardianId,enrollmentId};
  },"SERIALIZABLE");}catch(error){if(typeof error==="object"&&error&&"code" in error&&error.code==="23505")throw conflict("STUDENT_ADMISSION_EXISTS","Admission number already exists");throw error;}
}

export async function listStudents(tenantId:string,input:{cursor?:string;limit:number;status?:string;search?:string}){
  const cursor=decodeCursor(input.cursor); return withDatabaseContext({tenantId},async(manager)=>{
    const rows=await manager.query(`SELECT s.id,s.admission_no "admissionNo",s.first_name "firstName",s.last_name "lastName",s.date_of_birth "dateOfBirth",s.status,s.created_at "createdAt",e.class_id "classId",e.section_id "sectionId" FROM students s LEFT JOIN enrollments e ON e.student_id=s.id AND e.tenant_id=s.tenant_id AND e.status='ACTIVE' AND e.ends_on IS NULL WHERE s.tenant_id=$1 AND ($2::text IS NULL OR s.status=$2) AND ($3::text IS NULL OR s.admission_no ILIKE '%'||$3||'%' OR s.first_name ILIKE '%'||$3||'%' OR s.last_name ILIKE '%'||$3||'%') AND ($4::timestamptz IS NULL OR (s.created_at,s.id)<($4,$5::uuid)) ORDER BY s.created_at DESC,s.id DESC LIMIT $6`,[tenantId,input.status??null,input.search??null,cursor?.createdAt??null,cursor?.id??null,input.limit+1]);
    const hasMore=rows.length>input.limit; const data=hasMore?rows.slice(0,input.limit):rows; const last=data.at(-1);
    return {data,nextCursor:hasMore&&last?encodeCursor({createdAt:new Date(last.createdAt).toISOString(),id:last.id}):null};
  });
}

export async function getStudent(tenantId:string,id:string){ return withDatabaseContext({tenantId},async(manager)=>{ const [row]=await manager.query(`SELECT s.*,coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.id,'firstName',g.first_name,'lastName',g.last_name,'relationship',sg.relationship,'isPrimary',sg.is_primary)) FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id AND g.tenant_id=sg.tenant_id WHERE sg.student_id=s.id),'[]') guardians,coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.starts_on DESC) FROM enrollments e WHERE e.student_id=s.id AND e.tenant_id=s.tenant_id),'[]') enrollments FROM students s WHERE s.id=$1 AND s.tenant_id=$2`,[id,tenantId]); if(!row)throw notFound(); return row; }); }

export async function updateStudent(tenantId:string,actorId:string,id:string,input:{firstName?:string;lastName?:string;dateOfBirth?:string;sex?:string}){ return withDatabaseContext({tenantId},async(manager)=>{ const [row]=await manager.query(`UPDATE students SET first_name=coalesce($3,first_name),last_name=coalesce($4,last_name),date_of_birth=coalesce($5,date_of_birth),sex=coalesce($6,sex),updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING id,admission_no,first_name,last_name,date_of_birth,sex,status`,[id,tenantId,input.firstName??null,input.lastName??null,input.dateOfBirth??null,input.sex??null]); if(!row)throw notFound(); await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,result,correlation_id) VALUES($1,'USER',$2,'STUDENT_UPDATED','STUDENT',$3,'SUCCESS',gen_random_uuid())`,[tenantId,actorId,id]); return row; }); }

export async function transferStudent(tenantId:string,actorId:string,studentId:string,input:{currentEnrollmentId:string;campusId:string;classId:string;sectionId:string;effectiveOn:string;reason:string}){
  return withDatabaseContext({tenantId},async(manager)=>{
    const [current]=await manager.query(`SELECT * FROM enrollments WHERE id=$1 AND student_id=$2 AND tenant_id=$3 AND status='ACTIVE' AND ends_on IS NULL FOR UPDATE`,[input.currentEnrollmentId,studentId,tenantId]); if(!current)throw conflict("ENROLLMENT_NOT_ACTIVE","Current enrollment is no longer active");
    await validatePlacement(manager,tenantId,{academicYearId:current.academic_year_id,campusId:input.campusId,classId:input.classId,sectionId:input.sectionId});
    if(input.effectiveOn<current.starts_on)throw new AppError("TRANSFER_DATE_INVALID",422,"Transfer date cannot precede the current enrollment");
    await manager.query(`UPDATE enrollments SET ends_on=($2::date-1),status='TRANSFERRED' WHERE id=$1`,[current.id,input.effectiveOn]);
    const [next]=await manager.query(`INSERT INTO enrollments(tenant_id,student_id,academic_year_id,campus_id,class_id,section_id,starts_on,status,source) VALUES($1,$2,$3,$4,$5,$6,$7,'ACTIVE','TRANSFER') RETURNING id`,[tenantId,studentId,current.academic_year_id,input.campusId,input.classId,input.sectionId,input.effectiveOn]);
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,reason,result,correlation_id) VALUES($1,'USER',$2,'STUDENT_TRANSFERRED','STUDENT',$3,$4,'SUCCESS',gen_random_uuid())`,[tenantId,actorId,studentId,input.reason]); return {previousEnrollmentId:current.id,enrollmentId:next.id};
  },"SERIALIZABLE");
}
