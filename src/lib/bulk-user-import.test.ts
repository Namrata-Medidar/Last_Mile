import { describe, expect, it } from "vitest";
import { parseBulkUserFile, toSafeCsvCell, type BulkAssignableRole } from "./bulk-user-import";

const roles: BulkAssignableRole[] = [
  { id: "role-engineer", slug: "engineer", name: "Engineer", is_active: true },
  { id: "role-admin", slug: "admin", name: "Admin", is_active: true },
];

function csvFile(content: string, name = "users.csv") {
  const file = new File([content], name, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => content });
  return file;
}

describe("parseBulkUserFile", () => {
  it("parses CSV columns and resolves a role by display name", async () => {
    const preview = await parseBulkUserFile(
      csvFile(
        "Full name,Company,Phone,Work email,Role\r\nAsha Kumar,Example Co,+919876543210,asha@example.com,Engineer",
      ),
      roles,
    );

    expect(preview.errors).toEqual([]);
    expect(preview.rows).toEqual([
      {
        full_name: "Asha Kumar",
        company: "Example Co",
        phone: "+919876543210",
        email: "asha@example.com",
        role: "engineer",
      },
    ]);
  });

  it("supports quoted commas and reports duplicate emails", async () => {
    const preview = await parseBulkUserFile(
      csvFile(
        'Full name,Company,Phone,Work email,Role\n"Asha, K.","Example, Inc",9876543210,asha@example.com,engineer\nAnother,Other,9876543211,ASHA@example.com,engineer',
      ),
      roles,
    );

    expect(preview.errors).toContain("Row 3: Work email is duplicated in this file.");
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.company).toBe("Example, Inc");
  });

  it("rejects inactive or non-assignable roles", async () => {
    const preview = await parseBulkUserFile(
      csvFile("Full name,Company,Phone,Work email,Role\nAsha,Co,9876543210,asha@example.com,Owner"),
      roles,
    );

    expect(preview.rows).toEqual([]);
    expect(preview.errors[0]).toContain("not an active assignable role");
  });

  it("requires the requested columns", async () => {
    const preview = await parseBulkUserFile(csvFile("Name,Email\nAsha,asha@example.com"), roles);

    expect(preview.errors[0]).toContain("Missing required column(s)");
  });

  it("protects downloaded values from spreadsheet formula execution", () => {
    expect(toSafeCsvCell("=HYPERLINK(url)")).toBe(`"'=HYPERLINK(url)"`);
    expect(toSafeCsvCell("asha@example.com")).toBe(`"asha@example.com"`);
  });
});
