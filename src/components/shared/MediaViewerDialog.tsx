import { Download, ExternalLink, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getTransformedPublicImageUrl, isImageResource, isVideoResource } from "@/lib/supabase-storage";
import { cn } from "@/lib/utils";

type MediaViewerDialogProps = {
  mediaUrl: string;
  mediaName?: string | null;
  mediaMime?: string | null;
  triggerClassName?: string;
  title?: string;
  children: React.ReactNode;
};

export function MediaViewerDialog({
  mediaUrl,
  mediaName,
  mediaMime,
  triggerClassName,
  title,
  children,
}: MediaViewerDialogProps) {
  const resolvedTitle = title ?? mediaName ?? "Pratinjau Media";
  const fileName = mediaName ?? "media";
  const isImage = isImageResource(mediaMime, mediaName, mediaUrl);
  const isVideo = isVideoResource(mediaMime, mediaName, mediaUrl);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={cn("w-full text-left", triggerClassName)}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate">{resolvedTitle}</DialogTitle>
          <DialogDescription className="truncate">{fileName}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-2">
          {isImage ? (
            <img
              src={getTransformedPublicImageUrl(mediaUrl, {
                width: 1600,
                quality: 84,
                resize: "contain",
              })}
              alt={fileName}
              className="w-full max-h-[70vh] rounded object-contain"
            />
          ) : isVideo ? (
            <video
              src={mediaUrl}
              controls
              preload="metadata"
              className="w-full max-h-[70vh] rounded bg-black"
            >
              Browser Anda tidak mendukung pemutar video.
            </video>
          ) : (
            <div className="min-h-[220px] flex flex-col items-center justify-center gap-3 text-center">
              <Paperclip className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Pratinjau langsung tidak tersedia untuk tipe file ini.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-end gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={mediaUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </a>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <a href={mediaUrl} download={fileName}>
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
