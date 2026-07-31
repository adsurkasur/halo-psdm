import { useState, type MouseEvent } from "react";
import { EyeOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type HideChatSessionDialogProps = {
  onConfirm: () => Promise<void>;
  onHidden?: () => void;
  iconOnly?: boolean;
  className?: string;
};

export function HideChatSessionDialog({
  onConfirm,
  onHidden,
  iconOnly = false,
  className,
}: HideChatSessionDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsHiding(true);

    try {
      await onConfirm();
      setOpen(false);
      toast({
        title: "Sesi Disembunyikan",
        description: "Riwayat chat tetap tersimpan dan tindakan ini tercatat.",
      });
      onHidden?.();
    } catch (error) {
      toast({
        title: "Sesi gagal disembunyikan",
        description: error instanceof Error ? error.message : "Silakan coba kembali.",
        variant: "destructive",
      });
    } finally {
      setIsHiding(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size={iconOnly ? "icon" : "sm"}
          variant="outline"
          className={cn(iconOnly ? "h-8 w-8 shrink-0" : "gap-1.5 text-xs", className)}
          aria-label="Sembunyikan dari daftar"
          onClick={(event) => event.stopPropagation()}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {!iconOnly && <span className="hidden sm:inline">Sembunyikan dari daftar</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sembunyikan sesi dari daftar?</AlertDialogTitle>
          <AlertDialogDescription>
            Sesi hanya disembunyikan dari tampilan biasa. Semua pesan, media, identitas pelaku,
            dan catatan penutupan tetap tersimpan di database serta audit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isHiding}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isHiding}>
            {isHiding ? "Menyembunyikan..." : "Ya, sembunyikan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
