import { supabase } from "@/lib/supabase/client";

type ImageTransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

const IMAGE_MIME_PREFIX = "image/";
const VIDEO_MIME_PREFIX = "video/";
const ENABLE_IMAGE_TRANSFORM = process.env.NEXT_PUBLIC_ENABLE_IMAGE_TRANSFORM === "true";

export function isImageResource(
  mimeType?: string | null,
  fileName?: string | null,
  publicUrl?: string | null
): boolean {
  if (mimeType?.toLowerCase().startsWith(IMAGE_MIME_PREFIX)) {
    return true;
  }

  const lowerName = (fileName ?? "").toLowerCase();
  if (/(\.png|\.jpe?g|\.webp|\.bmp|\.gif)$/i.test(lowerName)) {
    return true;
  }

  const lowerUrl = (publicUrl ?? "").toLowerCase();
  return /(\.png|\.jpe?g|\.webp|\.bmp|\.gif)(\?|$)/i.test(lowerUrl);
}

export function isVideoResource(
  mimeType?: string | null,
  fileName?: string | null,
  publicUrl?: string | null
): boolean {
  if (mimeType?.toLowerCase().startsWith(VIDEO_MIME_PREFIX)) {
    return true;
  }

  const lowerName = (fileName ?? "").toLowerCase();
  if (/(\.mp4|\.webm|\.mov|\.m4v|\.avi|\.mkv)$/i.test(lowerName)) {
    return true;
  }

  const lowerUrl = (publicUrl ?? "").toLowerCase();
  return /(\.mp4|\.webm|\.mov|\.m4v|\.avi|\.mkv)(\?|$)/i.test(lowerUrl);
}

export function getChatMessagePreview(input: {
  content?: string | null;
  mediaName?: string | null;
  mediaUrl?: string | null;
  type?: string | null;
}): string {
  const content = (input.content ?? "").trim();
  if (content.length > 0) return content;

  const mediaName = (input.mediaName ?? "").trim();
  if (input.type === "IMAGE") {
    return mediaName ? `🖼️ ${mediaName}` : "🖼️ Gambar";
  }

  if (isVideoResource(undefined, mediaName, input.mediaUrl)) {
    return mediaName ? `🎬 ${mediaName}` : "🎬 Video";
  }

  if (mediaName.length > 0) {
    return `📎 ${mediaName}`;
  }

  return "📎 Media";
}

function extractBucketAndPath(publicUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(publicUrl);
    const marker = "/storage/v1/object/public/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const objectPart = url.pathname.slice(markerIndex + marker.length);
    const slashIndex = objectPart.indexOf("/");
    if (slashIndex === -1) return null;

    const bucket = decodeURIComponent(objectPart.slice(0, slashIndex));
    const path = decodeURIComponent(objectPart.slice(slashIndex + 1));

    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export function getTransformedPublicImageUrl(
  publicUrl?: string | null,
  options: ImageTransformOptions = {}
): string {
  if (!publicUrl) return "";

  // Some Supabase projects disable image transformation endpoint; fallback to raw URL by default.
  if (!ENABLE_IMAGE_TRANSFORM) {
    return publicUrl;
  }

  const target = extractBucketAndPath(publicUrl);
  if (!target) return publicUrl;

  const { data } = supabase.storage.from(target.bucket).getPublicUrl(target.path, {
    transform: {
      width: options.width,
      height: options.height,
      quality: options.quality,
      resize: options.resize,
    },
  });

  return data.publicUrl || publicUrl;
}

export async function downloadFileFromUrl(url: string, fileName = "download"): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Gagal mengunduh file.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
