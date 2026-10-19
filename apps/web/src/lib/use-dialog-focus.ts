"use client";

import { useEffect, useRef, type RefObject } from "react";
import { activateDialog } from "@/lib/dialog-focus";

type DialogLabel = { label: string; labelledBy?: never } | { labelledBy: string; label?: never };

export type UseDialogFocusOptions = DialogLabel & {
  open: boolean;
  /** Escape calls this. Leave it out (or null) for a dialog that can't be dismissed. */
  onClose?: (() => void) | null;
  /** What to focus when it opens; otherwise an element marked data-autofocus, then the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>;
  role?: "dialog" | "alertdialog";
};

/**
 * Makes an element a modal dialog for keyboards and screen readers. Spread the result on the dialog element:
 *
 *   const dialog = useDialogFocus({ open, onClose, labelledBy: "poll-title" });
 *   <div {...dialog} className="...">
 *
 * While open: focus moves inside, Tab and Shift+Tab wrap inside it, Escape calls onClose, and closing puts focus back
 * on whatever had it before. Works in popout windows (it uses the dialog's own document). See lib/dialog-focus.ts.
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>({ open, onClose, initialFocus, role = "dialog", label, labelledBy }: UseDialogFocusOptions) {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const container = ref.current;
    if (!open || !container) return;
    return activateDialog(container, {
      onEscape: () => onCloseRef.current?.(),
      initialFocus: () => initialFocus?.current ?? null,
    });
  }, [open, initialFocus]);

  return {
    ref,
    role,
    "aria-modal": true as const,
    "aria-label": label,
    "aria-labelledby": labelledBy,
    tabIndex: -1,
  };
}
