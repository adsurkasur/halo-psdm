import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
            } else if (el.validity.typeMismatch) {
              if (type === "email") {
                el.setCustomValidity("Harap masukkan alamat email yang valid (contoh: nama@arsc.org).");
              } else if (type === "url") {
                el.setCustomValidity("Harap masukkan tautan/URL yang valid.");
              } else {
                el.setCustomValidity("Harap masukkan format yang sesuai.");
              }
            } else if (el.validity.tooShort) {
              el.setCustomValidity(`Harap masukkan minimal ${el.minLength} karakter.`);
            } else if (el.validity.tooLong) {
              el.setCustomValidity(`Harap masukkan maksimal ${el.maxLength} karakter.`);
            } else if (el.validity.patternMismatch) {
              el.setCustomValidity("Format input tidak sesuai pola yang diminta.");
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
  },
);
Input.displayName = "Input";

export { Input };
