import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const BUCKET = "booking-attachments";
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type BookingAttachment = Tables<"booking_attachments">;

export const attachmentService = {
  async list(bookingId: string): Promise<BookingAttachment[]> {
    const { data, error } = await supabase
      .from("booking_attachments")
      .select("id, booking_id, file_name, storage_path, file_size, content_type, uploaded_at")
      .eq("booking_id", bookingId)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async upload(bookingId: string, file: File): Promise<BookingAttachment> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      throw new Error("A valid booking is required for the attachment.");
    }
    if (file.size === 0 || file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error("Attachments must be non-empty and no larger than 10 MB.");
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      throw new Error("Unsupported attachment type. Use PDF, JPEG, PNG, WebP, text, CSV, Word, or Excel files.");
    }
    const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-180) || "attachment";
    const storagePath = `${bookingId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      if (uploadError.message === "Bucket not found") {
        throw new Error(
          "Supabase Storage bucket 'booking-attachments' is missing. Apply the 0008_booking_attachments migration in Supabase to create the private bucket and its access policies.",
        );
      }
      if (uploadError.message.toLowerCase().includes("row-level security")) {
        throw new Error(
          `Storage rejected the upload because its booking-scoped INSERT policy denied it. Re-run the storage policies from 0008_booking_attachments.sql. ${uploadError.message}`,
        );
      }
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data, error: metadataError } = await supabase
      .from("booking_attachments")
      .insert({
        booking_id: bookingId,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        content_type: file.type || "application/octet-stream",
      })
      .select("id, booking_id, file_name, storage_path, file_size, content_type, uploaded_at")
      .single();

    if (metadataError) {
      const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([storagePath]);
      const schemaCacheIssue =
        metadataError.message.toLowerCase().includes("schema cache") ||
        metadataError.message.toLowerCase().includes("could not find the");
      const metadataMessage = schemaCacheIssue
        ? `Supabase's API schema cache does not include a booking_attachments column. Run the updated 0008_booking_attachments.sql migration (it adds missing metadata columns and reloads the cache). ${metadataError.message}`
        : metadataError.message.toLowerCase().includes("row-level security")
          ? `The booking_attachments row was denied by row-level security. Run 0009_booking_attachments_rls.sql in Supabase to replace conflicting policies with booking-scoped access. ${metadataError.message}`
          : `The booking_attachments row was rejected: ${metadataError.message}`;
      if (cleanupError) {
        throw new Error(
          `The file reached Storage, but ${metadataMessage}; uploaded-file cleanup also failed (${cleanupError.message}).`,
        );
      }
      throw new Error(`The file reached Storage, but ${metadataMessage}`);
    }

    return data;
  },

  async download(attachment: BookingAttachment): Promise<Blob> {
    const { data, error } = await supabase.storage.from(BUCKET).download(attachment.storage_path);
    if (error) throw error;
    return data;
  },
};
