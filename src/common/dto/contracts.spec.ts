import { describe, expect, it } from "vitest";
import { academicYearDto } from "@/modules/academics/dto";
import { correctionDto } from "@/modules/attendance/dto";
import { offlineBatchDto } from "@/modules/biometric/dto";
import { createSchoolDto } from "@/modules/tenancy/dto";

describe("API DTO contracts", () => {
  it("rejects unknown input instead of silently accepting it", () => {
    expect(() => createSchoolDto.parse({ slug: "school-a", name: "School A", timezone: "Asia/Karachi", isSuperAdmin: true })).toThrow();
  });

  it("rejects inverted effective dates", () => {
    expect(() => academicYearDto.parse({ name: "2026", startsOn: "2026-09-01", endsOn: "2026-08-31" })).toThrow(/endsOn/);
  });

  it("requires a real correction change", () => {
    expect(() => correctionDto.parse({ expectedVersion: 1, reasonCode: "DEVICE_FAILURE", proposedValues: {} })).toThrow();
  });

  it("rejects an inverted offline sequence range", () => {
    expect(() => offlineBatchDto.parse({ batchRef: "batch-1", firstSequence: 10, lastSequence: 9, events: [] })).toThrow();
  });
});
