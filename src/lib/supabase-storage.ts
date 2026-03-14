import { supabase } from "@/lib/supabase/client";

type ImageTransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

const IMAGE_MIME_PREFIX = "image/";

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
