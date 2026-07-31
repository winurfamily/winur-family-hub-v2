"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal yang berubah bentuk mengikuti lebar layar (J.8/J.9):
 *  - mobile : bottom sheet menempel di bawah, tinggi maksimal 92% layar,
 *             isinya bisa di-scroll sendiri sehingga keyboard tidak menutupi
 *             tombol aksi.
 *  - desktop: dialog tengah biasa.
 *
 * Dibangun langsung di atas Radix Dialog, bukan komponen Dialog bawaan, karena
 * bawaannya memaksa posisi tengah dan `max-w-lg` di semua ukuran layar.
 */
const ResponsiveSheet = DialogPrimitive.Root;
const ResponsiveSheetTrigger = DialogPrimitive.Trigger;
const ResponsiveSheetClose = DialogPrimitive.Close;

const ResponsiveSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Judul wajib untuk pembaca layar; disembunyikan bila showTitle=false. */
    title: string;
    description?: string;
    showTitle?: boolean;
  }
>(({ className, children, title, description, showTitle = true, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col bg-card text-ink-1 shadow-card-deep",
        "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[24px] border-t-2 border-border",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px] sm:border-2",
        "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    >
      {/* Pegangan geser — penanda visual bahwa panel bisa ditutup di mobile. */}
      <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />

      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-3 sm:pt-5">
        <div className={cn("min-w-0", !showTitle && "sr-only")}>
          <DialogPrimitive.Title className="font-heading text-lg font-black leading-tight text-ink-1">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-0.5 text-xs font-semibold text-ink-3">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        {!description && !showTitle && (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {/* ml-auto: saat judulnya disembunyikan (sr-only) slot kiri menciut,
            tanpa ini tombol tutup ikut melompat ke kiri. */}
        <DialogPrimitive.Close
          aria-label="Tutup"
          className="tap-target -mr-1.5 -mt-1.5 ml-auto flex shrink-0 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
      </div>

      <div className="safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
        {children}
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ResponsiveSheetContent.displayName = "ResponsiveSheetContent";

export { ResponsiveSheet, ResponsiveSheetTrigger, ResponsiveSheetClose, ResponsiveSheetContent };
