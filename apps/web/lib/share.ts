import { toast } from "sonner";

/** Copies a link and says so. */
export async function copyLink(url: string, copied = "Link kopiert."): Promise<void> {
  await navigator.clipboard.writeText(url);
  toast.success(copied);
}

/**
 * The share sheet of the phone where there is one, else the link is copied. Closing the share sheet without
 * sharing is no error.
 */
export async function shareOrCopy(data: { title: string; text?: string; url: string }, copied?: string): Promise<void> {
  if (!navigator.share) {
    await copyLink(data.url, copied);
    return;
  }
  try {
    await navigator.share(data);
  } catch {
    // closed without sharing
  }
}
