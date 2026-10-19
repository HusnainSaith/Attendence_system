import { describe, expect, it } from "vitest";
import { schoolInput, studentInput } from "./schemas";

describe("directory input contracts", () => {
  it("normalizes school input", () => {
    expect(schoolInput.parse({ slug: "school-one", name: " School One ", timezone: "Asia/Karachi" }).name).toBe("School One");
  });
  it("rejects malformed dates and slugs", () => {
    expect(() => studentInput.parse({ admissionNo: "A1", firstName: "A", lastName: "B", dateOfBirth: "30-09-2014" })).toThrow();
    expect(() => schoolInput.parse({ slug: "School One", name: "School", timezone: "Asia/Karachi" })).toThrow();
  });
});
