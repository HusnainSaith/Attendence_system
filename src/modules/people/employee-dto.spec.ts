import { describe,expect,it } from "vitest";
import { employeeCategoryDto,employeeDto,employeeListQueryDto,teacherAssignmentDto } from "./dto";

describe("employee workflow contracts",()=>{
  it("accepts a teaching employee",()=>{const value=employeeDto.parse({employeeNo:"T-001",firstName:"Ali",lastName:"Khan",category:"TEACHER"});expect(value.category).toBe("TEACHER");});
  it("defaults category teaching policy",()=>{expect(employeeCategoryDto.parse({code:"ADMIN",name:"Administration"}).teaching).toBe(false);});
  it("rejects invalid assignment dates",()=>{expect(()=>teacherAssignmentDto.parse({employeeId:crypto.randomUUID(),campusId:crypto.randomUUID(),classId:crypto.randomUUID(),startsOn:"2026-10-10",endsOn:"2026-10-01"})).toThrow(/endsOn/);});
  it("bounds employee pagination",()=>{expect(employeeListQueryDto.parse({limit:"25"}).limit).toBe(25);expect(()=>employeeListQueryDto.parse({limit:0})).toThrow();});
});
