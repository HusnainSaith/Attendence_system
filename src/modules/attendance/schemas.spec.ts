import { describe,expect,it } from "vitest";
import { attendancePolicyDto,attendanceSessionDto,manualAttendanceDto } from "./schemas";
const session=()=>({campusId:crypto.randomUUID(),academicYearId:crypto.randomUUID(),policyId:crypto.randomUUID(),sessionDate:"2026-10-04",type:"MORNING",startsAt:"2026-10-04T08:00:00+05:00",closesAt:"2026-10-04T10:00:00+05:00",scopes:[{scopeType:"SECTION",scopeId:crypto.randomUUID()}]});
describe("attendance contracts",()=>{
  it("accepts a bounded policy",()=>expect(attendancePolicyDto.parse({name:"Morning",timezone:"Asia/Karachi",rules:{lateAfterMinutes:15,absentAfterMinutes:60},effectiveFrom:"2026-08-01"}).rules.debounceSeconds).toBe(30));
  it("rejects reversed policy dates",()=>expect(()=>attendancePolicyDto.parse({name:"Morning",timezone:"Asia/Karachi",rules:{lateAfterMinutes:15,absentAfterMinutes:60},effectiveFrom:"2026-08-02",effectiveTo:"2026-08-01"})).toThrow());
  it("accepts a scoped session",()=>expect(attendanceSessionDto.parse(session()).scopes).toHaveLength(1));
  it("rejects duplicate scopes and reversed times",()=>{const value=session();value.scopes.push(value.scopes[0]);expect(()=>attendanceSessionDto.parse(value)).toThrow(/unique/);expect(()=>attendanceSessionDto.parse({...session(),closesAt:"2026-10-04T07:00:00+05:00"})).toThrow(/after/);});
  it("requires a manual-marking reason",()=>expect(()=>manualAttendanceDto.parse({subjectType:"STUDENT",subjectId:crypto.randomUUID(),status:"PRESENT"})).toThrow());
});
