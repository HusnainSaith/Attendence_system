import { describe, expect, it } from "vitest";
import { createPeopleImportDto, employeeImportRowDto, studentImportRowDto } from "@/modules/people/dto";

describe("people import contracts", () => {
  it("accepts a bounded student batch", () => expect(createPeopleImportDto.parse({ type: "STUDENTS", rows: [{ admissionNo: "A-1" }] }).rows).toHaveLength(1));
  it("rejects empty and oversized batches", () => { expect(() => createPeopleImportDto.parse({ type: "STUDENTS", rows: [] })).toThrow(); expect(() => createPeopleImportDto.parse({ type: "EMPLOYEES", rows: Array(1001).fill({}) })).toThrow(); });
  it("validates student rows without nested guardians", () => { expect(studentImportRowDto.parse({ admissionNo: "A-1", firstName: "A", lastName: "B", dateOfBirth: "2015-01-01" }).admissionNo).toBe("A-1"); expect(() => studentImportRowDto.parse({ admissionNo: "A-1", firstName: "A", lastName: "B", dateOfBirth: "2015-01-01", guardian: {} })).toThrow(); });
  it("validates employee import rows", () => expect(employeeImportRowDto.parse({ employeeNo: "E-1", firstName: "Ali", lastName: "Khan", category: "TEACHER" }).category).toBe("TEACHER"));
  it("rejects unsupported import types", () => expect(() => createPeopleImportDto.parse({ type: "GUARDIANS", rows: [{}] })).toThrow());
});
