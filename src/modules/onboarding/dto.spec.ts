import { describe,expect,it } from "vitest";
import { schoolOnboardingDto } from "./dto";

const valid={school:{slug:"demo-school",name:"Demo School",timezone:"Asia/Karachi"},principal:{email:"principal@example.test",firstName:"Sara",lastName:"Khan"},campus:{code:"MAIN",name:"Main Campus"},academicYear:{name:"2026-27",startsOn:"2026-08-01",endsOn:"2027-06-30"},classes:[{code:"G1",name:"Grade 1",sections:[{code:"A",name:"Section A",capacity:30}]}],attendancePolicy:{}};

describe("school onboarding contract",()=>{
  it("normalizes defaults for one complete setup",()=>{ const parsed=schoolOnboardingDto.parse(valid); expect(parsed.school.locale).toBe("en-PK"); expect(parsed.attendancePolicy.debounceSeconds).toBe(30); });
  it("rejects duplicate class codes case-insensitively",()=>{ expect(()=>schoolOnboardingDto.parse({...valid,classes:[valid.classes[0],{...valid.classes[0],code:"g1"}]})).toThrow(/Class codes/); });
  it("rejects duplicate sections within a class",()=>{ expect(()=>schoolOnboardingDto.parse({...valid,classes:[{...valid.classes[0],sections:[{code:"A",name:"A"},{code:"a",name:"Again"}]}]})).toThrow(/Section codes/); });
  it("rejects inverted academic-year dates",()=>{ expect(()=>schoolOnboardingDto.parse({...valid,academicYear:{...valid.academicYear,endsOn:"2026-07-01"}})).toThrow(/Academic year/); });
});
