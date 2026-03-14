import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTransformedPublicImageUrl } from "@/lib/supabase-storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type UserAvatarWithPreviewProps = {
  name: string;
  avatarUrl?: string | null;
  sizeClassName?: string;
  fallbackClassName?: string;
  modalTitle?: string;
  disablePreview?: boolean;
};

export function UserAvatarWithPreview({
  name,
  avatarUrl,
  sizeClassName = "h-9 w-9",
  fallbackClassName = "bg-primary text-primary-foreground text-xs",
  modalTitle = "Foto Profil",
  disablePreview = false,
}: UserAvatarWithPreviewProps) {
  const [open, setOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string>("");
  const [previewSrc, setPreviewSrc] = useState<string>("");

  const transformedAvatarSrc = useMemo(
    () =>
      avatarUrl
        ? getTransformedPublicImageUrl(avatarUrl, {
            width: 160,
            height: 160,
            quality: 74,
            resize: "cover",
          })
        : "",
    [avatarUrl],
  );

  const transformedPreviewSrc = useMemo(
    () =>
      avatarUrl
        ? getTransformedPublicImageUrl(avatarUrl, {
            width: 1440,
            quality: 84,
            resize: "contain",
          })
        : "",
    [avatarUrl],
  );

  useEffect(() => {
    setAvatarSrc(transformedAvatarSrc || avatarUrl || "");
    setPreviewSrc(transformedPreviewSrc || avatarUrl || "");
  }, [avatarUrl, transformedAvatarSrc, transformedPreviewSrc]);

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatar = (
    <Avatar className={sizeClassName}>
      {avatarSrc ? (
        <AvatarImage
          src={avatarSrc}
          alt={name}
          onError={() => {
            if (!avatarUrl) return;
            if (avatarSrc !== avatarUrl) {
              setAvatarSrc(avatarUrl);
              return;
            }
            setAvatarSrc("");
          }}
        />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );

  if (!avatarUrl || disablePreview) return avatar;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="rounded-full ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          {avatar}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg overflow-hidden border bg-muted/30">
          <img
            src={previewSrc || avatarUrl}
            alt={name}
            className="w-full h-auto max-h-[70vh] object-contain"
            onError={() => {
              if (!avatarUrl) return;
              if (previewSrc !== avatarUrl) {
                setPreviewSrc(avatarUrl);
                return;
              }
              setPreviewSrc("");
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
