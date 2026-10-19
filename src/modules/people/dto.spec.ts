import { describe,expect,it } from "vitest";
import { createStudentDto,studentListQueryDto,transferStudentDto } from "./dto";

describe("student workflow contracts",()=>{
  it("accepts a complete admission aggregate",()=>{const value=createStudentDto.parse({admissionNo:"A-100",firstName:"Ayesha",lastName:"Khan",dateOfBirth:"2014-05-12",guardian:{firstName:"Sara",lastName:"Khan",phone:"+923001234567",relationship:"MOTHER"},enrollment:{academicYearId:crypto.randomUUID(),campusId:crypto.randomUUID(),classId:crypto.randomUUID(),sectionId:crypto.randomUUID(),startsOn:"2026-08-01"}});expect(value.guardian?.notificationAuthority).toBe(true);});
  it("requires guardian contact information",()=>{expect(()=>createStudentDto.parse({admissionNo:"A-101",firstName:"A",lastName:"B",dateOfBirth:"2014-05-12",guardian:{firstName:"G",lastName:"B",relationship:"MOTHER"}})).toThrow(/phone or email/);});
  it("bounds keyset pagination",()=>{expect(studentListQueryDto.parse({limit:"100"}).limit).toBe(100);expect(()=>studentListQueryDto.parse({limit:"101"})).toThrow();});
  it("rejects unknown transfer fields",()=>{expect(()=>transferStudentDto.parse({currentEnrollmentId:crypto.randomUUID(),campusId:crypto.randomUUID(),classId:crypto.randomUUID(),sectionId:crypto.randomUUID(),effectiveOn:"2026-09-01",reason:"Move",tenantId:crypto.randomUUID()})).toThrow();});
});
