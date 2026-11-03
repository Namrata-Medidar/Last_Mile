import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseBulkUserFile,
  toCsvCell,
  toSafeCsvCell,
  type BulkAssignableRole,
  type BulkUserImportRow,
} from "@/lib/bulk-user-import";
import { bulkUserService, type BulkUserCreationResult } from "@/services/bulkUserService";

type Props = {
  roles: BulkAssignableRole[];
  onComplete: () => Promise<void>;
};

const template = [
  ["Full name", "Company", "Phone", "Work email", "Role"],
  ["Asha Kumar", "Example Company", "9876543210", "asha@example.com", "Engineer"],
];

function downloadCsv(filename: string, rows: string[][], protectFormulas = false) {
  const encode = protectFormulas ? toSafeCsvCell : toCsvCell;
  const content = `\uFEFF${rows.map((row) => row.map(encode).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function BulkUserUpload({ roles, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<BulkUserImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<BulkUserCreationResult[] | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [credentialsDownloaded, setCredentialsDownloaded] = useState(false);
  const [actionError, setActionError] = useState("");

  const reset = () => {
    setFileName("");
    setRows([]);
    setErrors([]);
    setResults(null);
    setCredentialsDownloaded(false);
    setActionError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isCreating) return;
    if (!nextOpen && credentials.length > 0 && !credentialsDownloaded) return;
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const handleFile = async (file?: File) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    setIsReading(true);
    try {
      const preview = await parseBulkUserFile(file, roles);
      setRows(preview.rows);
      setErrors(preview.errors);
    } finally {
      setIsReading(false);
    }
  };

  const createUsers = async () => {
    setActionError("");
    setIsCreating(true);
    try {
      const creationResults = await bulkUserService.createUsers(rows);
      setResults(creationResults);
      await onComplete();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bulk user creation failed.");
    } finally {
      setIsCreating(false);
    }
  };

  const credentials = (results ?? []).filter((result) => result.password);
  const failures = (results ?? []).filter((result) => result.error);

  return (
    <>
      {/* <Button type="button" onClick={() => setOpen(true)}>
        <Upload /> Bulk upload
      </Button> */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk upload users</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file with Full name, Company, Phone, Work email, and Role. New
              accounts receive a generated initial password; no email is sent.
            </DialogDescription>
          </DialogHeader>

          {!results && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="sr-only"
                  aria-label="Choose user upload file"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload /> Choose CSV or Excel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    downloadCsv(
                      "user-upload-template.csv",
                      template.map((row) => row.map(toCsvCell)),
                    )
                  }
                >
                  <Download /> Download template
                </Button>
                {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
              </div>

              <p className="text-xs text-muted-foreground">
                Use an active role name or role slug. Maximum 100 users and 5 MB per file. Existing
                email addresses will not be overwritten.
              </p>

              {isReading && (
                <p role="status" className="text-sm">
                  Reading upload...
                </p>
              )}
              {errors.length > 0 && (
                <ul
                  role="alert"
                  className="max-h-40 list-inside list-disc overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
              {rows.length > 0 && errors.length === 0 && (
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">{rows.length} user(s) ready to create</p>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr>
                          <th className="p-1">Name</th>
                          <th className="p-1">Work email</th>
                          <th className="p-1">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.email} className="border-t">
                            <td className="p-1">{row.full_name}</td>
                            <td className="p-1">{row.email}</td>
                            <td className="p-1">
                              {roles.find((role) => role.slug === row.role)?.name ?? row.role}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <p className="text-sm">
                Created {credentials.length} account(s); {failures.length} row(s) failed.
              </p>
              {credentials.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-medium">Download the passwords now.</p>
                  <p className="mt-1 text-xs">
                    Passwords are shown only in this download. They are not emailed or saved in the
                    app. Store the file securely and share each user’s credentials privately.
                  </p>
                  <Button
                    type="button"
                    className="mt-3"
                    onClick={() => {
                      downloadCsv(
                        "new-user-credentials.csv",
                        [
                          ["Full name", "Work email", "Role", "Initial password"],
                          ...credentials.map((user) => [
                            user.full_name,
                            user.email,
                            user.role,
                            user.password!,
                          ]),
                        ],
                        true,
                      );
                      setCredentialsDownloaded(true);
                    }}
                  >
                    <Download /> Download credentials
                  </Button>
                  {!credentialsDownloaded && (
                    <p className="mt-2 text-xs">
                      Download the credentials file before closing this dialog.
                    </p>
                  )}
                </div>
              )}
              {results.map((result) => (
                <p
                  key={`${result.email}-${result.role}`}
                  className={
                    result.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                  }
                >
                  {result.email}: {result.error ?? "Created"}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating || (credentials.length > 0 && !credentialsDownloaded)}
            >
              {results ? "Done" : "Cancel"}
            </Button>
            {!results && (
              <Button
                type="button"
                onClick={() => void createUsers()}
                disabled={isCreating || isReading || rows.length === 0 || errors.length > 0}
              >
                {isCreating ? "Creating accounts..." : `Create ${rows.length || ""} account(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
