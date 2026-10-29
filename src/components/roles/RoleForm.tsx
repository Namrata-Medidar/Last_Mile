
import { useEffect, useState, type FormEvent } from "react";
import type {
  AppRole,
  CreateRoleInput,
} from "@/services/rolePermissionService";

type RoleFormProps = {
  role?: AppRole | null;
  isSaving?: boolean;
  onSubmit: (input: CreateRoleInput) => Promise<void>;
  onCancel: () => void;
};

export function RoleForm({
  role,
  isSaving = false,
  onSubmit,
  onCancel,
}: RoleFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(role?.name ?? "");
    setSlug(role?.slug ?? "");
    setDescription(role?.description ?? "");
    setSlugEdited(Boolean(role));
    setError("");
  }, [role]);

  function handleNameChange(value: string) {
    setName(value);

    if (!slugEdited) {
      setSlug(
        value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, ""),
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (!trimmedName) {
      setError("Role name is required.");
      return;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(trimmedSlug)) {
      setError(
        "Slug must start with a letter and contain only lowercase letters, numbers, and underscores.",
      );
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        slug: trimmedSlug,
        description: description.trim() || null,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save this role.",
      );
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {role ? "Edit role" : "Create a new role"}
          </h2>
         
        </div>

        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {role ? "Editing" : "New role"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="role-name"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Role name <span className="text-red-500">*</span>
            </label>
            <input
              id="role-name"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="e.g. Support Manager"
              maxLength={80}
              required
              disabled={isSaving || Boolean(role?.is_system)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="role-slug"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Role slug <span className="text-red-500">*</span>
            </label>
            <input
              id="role-slug"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
              placeholder="e.g. support_manager"
              maxLength={80}
              required
              disabled={isSaving || Boolean(role?.is_system)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Lowercase letters, numbers and underscores only.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="role-description"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what this role is responsible for..."
            rows={3}
            maxLength={500}
            disabled={isSaving || Boolean(role?.is_system)}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </div>

        {role?.is_system && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            System roles cannot be edited.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving || Boolean(role?.is_system)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : role
                ? "Save changes"
                : "Create role"}
          </button>
        </div>
      </form>
    </section>
  );
}
