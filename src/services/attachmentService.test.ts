import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, upload } = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from,
  storage: { from: () => ({ upload }) },
} }));

import { attachmentService, MAX_ATTACHMENT_SIZE } from "./attachmentService";

const bookingId = "00000000-0000-4000-8000-000000000001";

describe("attachment validation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("rejects empty files before calling storage", async () => {
    await expect(attachmentService.upload(bookingId, new File([], "empty.txt", { type: "text/plain" }))).rejects.toThrow("non-empty");
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects oversized files before calling storage", async () => {
    const file = new File(["test"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: MAX_ATTACHMENT_SIZE + 1 });
    await expect(attachmentService.upload(bookingId, file)).rejects.toThrow("10 MB");
    expect(upload).not.toHaveBeenCalled();
  });

  it.each(["text/html", "image/svg+xml", "application/javascript", "application/octet-stream"])("rejects disallowed MIME type %s", async (type) => {
    await expect(attachmentService.upload(bookingId, new File(["test"], "unsafe", { type }))).rejects.toThrow("Unsupported attachment type");
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects path manipulation in a booking ID", async () => {
    await expect(attachmentService.upload("../other-booking", new File(["test"], "safe.txt", { type: "text/plain" }))).rejects.toThrow("valid booking");
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads an allowed file within the booking scope", async () => {
    upload.mockResolvedValue({ error: null });
    const attachment = { id: "attachment-id" };
    const single = vi.fn().mockResolvedValue({ data: attachment, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    from.mockReturnValue({ insert });
    const file = new File(["test"], "note.txt", { type: "text/plain" });
    await expect(attachmentService.upload(bookingId, file)).resolves.toEqual(attachment);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${bookingId}/`)), file, { contentType: "text/plain", upsert: false });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ booking_id: bookingId, content_type: "text/plain", file_size: 4 }));
  });
});