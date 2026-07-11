import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      onInvalid={(e) => {
        if (props.onInvalid) {
          props.onInvalid(e);
        } else {
          const el = e.currentTarget;
          if (el.validity.valueMissing) {
            el.setCustomValidity("Harap isi kolom ini terlebih dahulu.");
          } else if (el.validity.tooShort) {
            el.setCustomValidity(`Harap masukkan minimal ${el.minLength} karakter.`);
          } else if (el.validity.tooLong) {
            el.setCustomValidity(`Harap masukkan maksimal ${el.maxLength} karakter.`);
          } else {
            el.setCustomValidity("Input tidak valid.");
          }
        }
      }}
      onInput={(e) => {
        if (props.onInput) {
          props.onInput(e);
        }
        e.currentTarget.setCustomValidity("");
      }}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
