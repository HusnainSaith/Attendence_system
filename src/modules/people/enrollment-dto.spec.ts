import { describe, expect, it } from "vitest";
import { promoteStudentsDto } from "./dto";

const valid = () => ({
  sourceAcademicYearId: crypto.randomUUID(),
  sourceSectionId: crypto.randomUUID(),
  targetAcademicYearId: crypto.randomUUID(),
  targetCampusId: crypto.randomUUID(),
  targetClassId: crypto.randomUUID(),
  targetSectionId: crypto.randomUUID(),
  startsOn: "2027-08-01",
});

describe("promotion contracts", () => {
  it("accepts a section-wide promotion", () => expect(promoteStudentsDto.parse(valid()).studentIds).toBeUndefined());
  it("accepts a selected student cohort", () => expect(promoteStudentsDto.parse({ ...valid(), studentIds: [crypto.randomUUID()] }).studentIds).toHaveLength(1));
  it("rejects promotion within the same academic year", () => { const value = valid(); value.targetAcademicYearId = value.sourceAcademicYearId; expect(() => promoteStudentsDto.parse(value)).toThrow(/must differ/); });
  it("rejects empty and oversized cohorts", () => { expect(() => promoteStudentsDto.parse({ ...valid(), studentIds: [] })).toThrow(); expect(() => promoteStudentsDto.parse({ ...valid(), studentIds: Array.from({ length: 501 }, () => crypto.randomUUID()) })).toThrow(); });
  it("rejects duplicate student IDs", () => { const id = crypto.randomUUID(); expect(() => promoteStudentsDto.parse({ ...valid(), studentIds: [id, id] })).toThrow(/must be unique/); });
  it("rejects unexpected tenant fields", () => expect(() => promoteStudentsDto.parse({ ...valid(), tenantId: crypto.randomUUID() })).toThrow());
});
