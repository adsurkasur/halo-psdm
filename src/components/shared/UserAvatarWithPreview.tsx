import { useState } from "react";
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

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatar = (
    <Avatar className={sizeClassName}>
      {avatarUrl ? (
        <AvatarImage
          src={getTransformedPublicImageUrl(avatarUrl, {
            width: 160,
            height: 160,
            quality: 74,
            resize: "cover",
          })}
          alt={name}
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
            src={getTransformedPublicImageUrl(avatarUrl, {
              width: 1440,
              quality: 84,
              resize: "contain",
            })}
            alt={name}
            className="w-full h-auto max-h-[70vh] object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
