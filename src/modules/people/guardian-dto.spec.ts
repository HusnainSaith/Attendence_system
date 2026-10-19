import { describe,expect,it } from "vitest";
import { createGuardianDto,guardianListQueryDto,linkGuardianDto,updateGuardianDto } from "./dto";

describe("guardian contracts",()=>{
  it("requires at least one contact method",()=>{expect(()=>createGuardianDto.parse({firstName:"Sara",lastName:"Khan"})).toThrow(/phone or email/);});
  it("rejects an empty update",()=>{expect(()=>updateGuardianDto.parse({})).toThrow(/At least one/);});
  it("defaults link authority safely",()=>{const link=linkGuardianDto.parse({guardianId:crypto.randomUUID(),relationship:"MOTHER"});expect(link.isPrimary).toBe(false);expect(link.notificationAuthority).toBe(true);});
  it("bounds guardian pagination",()=>{expect(guardianListQueryDto.parse({limit:"50"}).limit).toBe(50);expect(()=>guardianListQueryDto.parse({limit:500})).toThrow();});
});
