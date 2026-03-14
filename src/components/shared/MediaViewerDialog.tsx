import { useMemo, useState } from "react";
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
import { downloadFileFromUrl, getTransformedPublicImageUrl, isImageResource, isVideoResource } from "@/lib/supabase-storage";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const resolvedTitle = title ?? mediaName ?? "Pratinjau Media";
  const fileName = mediaName ?? "media";
  const isImage = isImageResource(mediaMime, mediaName, mediaUrl);
  const isVideo = isVideoResource(mediaMime, mediaName, mediaUrl);
  const imageSrc = useMemo(
    () =>
      getTransformedPublicImageUrl(mediaUrl, {
        width: 1600,
        quality: 84,
        resize: "contain",
      }),
    [mediaUrl],
  );

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
              src={imageSrc}
              alt={fileName}
              className="w-full max-h-[70vh] rounded object-contain"
              onError={(e) => {
                if (e.currentTarget.src !== mediaUrl) {
                  e.currentTarget.src = mediaUrl;
                }
              }}
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
          <Button
            size="sm"
            className="gap-2"
            disabled={downloading}
            onClick={async () => {
              try {
                setDownloading(true);
                await downloadFileFromUrl(mediaUrl, fileName);
              } catch (error) {
                toast({
                  title: error instanceof Error ? error.message : "Gagal mengunduh file.",
                  variant: "destructive",
                });
              } finally {
                setDownloading(false);
              }
            }}
          >
            <Download className="h-4 w-4" />
            {downloading ? "Mengunduh..." : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
