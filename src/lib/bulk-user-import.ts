import readXlsxFile from "read-excel-file/browser";

export type BulkAssignableRole = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

export type BulkUserImportRow = {
  full_name: string;
  company: string;
  phone: string;
  email: string;
  role: string;
};

export type BulkUserImportPreview = {
  rows: BulkUserImportRow[];
  errors: string[];
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 100;
const ASSIGNABLE_ROLE_SLUGS = new Set([
  "super_admin",
  "admin",
  "ops_manager",
  "engineer",
  "customer",
]);
const REQUIRED_HEADERS = ["fullname", "company", "phone", "workemail", "role"] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error("The CSV file contains an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  const header = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return header === "email" ? "workemail" : header;
}

function normalizeRows(matrix: string[][], roles: BulkAssignableRole[]): BulkUserImportPreview {
  if (matrix.length === 0) {
    return { rows: [], errors: ["The file is empty. Add a header row and at least one user."] };
  }

  const headerRow = matrix[0];
  if (!headerRow) {
    return { rows: [], errors: ["The file is empty. Add a header row and at least one user."] };
  }

  const headers = headerRow.map(normalizeHeader);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !indexes.has(header));
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [
        `Missing required column(s): ${missingHeaders
          .map((header) => {
            const labels: Record<string, string> = {
              fullname: "Full name",
              company: "Company",
              phone: "Phone",
              workemail: "Work email",
              role: "Role",
            };
            return labels[header];
          })
          .join(", ")}.`,
      ],
    };
  }

  const roleOptions = roles.filter(
    (role) => role.is_active && ASSIGNABLE_ROLE_SLUGS.has(role.slug),
  );
  const roleByValue = new Map<string, string>();
  for (const role of roleOptions) {
    roleByValue.set(role.slug.toLowerCase(), role.slug);
    roleByValue.set(role.name.trim().toLowerCase(), role.slug);
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return {
      rows: [],
      errors: [`Upload no more than ${MAX_ROWS} users at a time.`],
    };
  }

  const rows: BulkUserImportRow[] = [];
  const errors: string[] = [];
  const seenEmails = new Set<string>();

  dataRows.forEach((values, offset) => {
    const rowNumber = offset + 2;
    const getValue = (header: string) => values[indexes.get(header)!]?.trim() ?? "";
    const fullName = getValue("fullname");
    const company = getValue("company");
    const phone = getValue("phone");
    const email = getValue("workemail").toLowerCase();
    const roleValue = getValue("role").toLowerCase();
    const role = roleByValue.get(roleValue);
    const rowErrors: string[] = [];

    if (!fullName || fullName.length > 100)
      rowErrors.push("Full name is required (max 100 characters)");
    if (!company || company.length > 120)
      rowErrors.push("Company is required (max 120 characters)");
    if (!/^\+?[0-9 ]{8,16}$/.test(phone)) rowErrors.push("Enter a valid phone number");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      rowErrors.push("Enter a valid work email");
    }
    if (!role)
      rowErrors.push(`Role "${getValue("role") || "(empty)"}" is not an active assignable role`);
    if (seenEmails.has(email)) rowErrors.push("Work email is duplicated in this file");

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}.`);
      return;
    }

    seenEmails.add(email);
    rows.push({ full_name: fullName, company, phone, email, role: role! });
  });

  if (dataRows.length === 0) errors.push("Add at least one user below the header row.");
  return { rows, errors };
}

export async function parseBulkUserFile(
  file: File,
  roles: BulkAssignableRole[],
): Promise<BulkUserImportPreview> {
  if (file.size > MAX_FILE_SIZE) {
    return { rows: [], errors: ["The upload must be 5 MB or smaller."] };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  try {
    if (extension === "csv") {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      return normalizeRows(parseCsv(text), roles);
    }

    if (extension === "xlsx") {
      const sheets = await readXlsxFile(file);
      const sheet = sheets[0];
      if (!sheet) return { rows: [], errors: ["The Excel file has no worksheets."] };
      const matrix = sheet.data.map((row) =>
        row.map((value) => (value == null ? "" : String(value))),
      );
      return normalizeRows(matrix, roles);
    }

    return { rows: [], errors: ["Choose a .csv or .xlsx file."] };
  } catch (error) {
    return {
      rows: [],
      errors: [error instanceof Error ? error.message : "The file could not be read."],
    };
  }
}

export function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function toSafeCsvCell(value: string): string {
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return toCsvCell(safeValue);
}
