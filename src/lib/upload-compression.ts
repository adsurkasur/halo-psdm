import imageCompression from "browser-image-compression";

const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
]);

export type ImageCompressionProfile = "attachment" | "chat";

type CompressionOutcome = {
  file: File;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
};

function withUpdatedExtension(fileName: string, mimeType: string): string {
  const extByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/bmp": "bmp",
  };
  const ext = extByMime[mimeType] ?? "bin";
  const base = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;
  return `${base}.${ext}`;
}

export function isCompressibleImage(file: File | null | undefined): file is File {
  return Boolean(file && COMPRESSIBLE_IMAGE_TYPES.has(file.type.toLowerCase()));
}

function getProfileOptions(profile: ImageCompressionProfile) {
  if (profile === "chat") {
    return {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      initialQuality: 0.76,
    };
  }

  return {
    maxSizeMB: 1.2,
    maxWidthOrHeight: 1920,
    initialQuality: 0.78,
  };
}

export async function compressImageForUpload(file: File, profile: ImageCompressionProfile): Promise<CompressionOutcome> {
  const options = getProfileOptions(profile);
  const compressed = await imageCompression(file, {
    ...options,
    useWebWorker: true,
    alwaysKeepResolution: false,
    fileType: "image/webp",
  });

  const nextName = withUpdatedExtension(file.name, compressed.type || "image/webp");
  const outputFile = new File([compressed], nextName, {
    type: compressed.type || "image/webp",
    lastModified: Date.now(),
  });

  const effectivelyCompressed = outputFile.size < file.size * 0.97;
  if (!effectivelyCompressed) {
    return {
      file,
      compressed: false,
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  return {
    file: outputFile,
    compressed: true,
    originalSize: file.size,
    compressedSize: outputFile.size,
  };
}
