"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * A vertical divider that resizes the sidebar next to it. Drag it with the mouse, or focus it and use the arrow keys
 * (Shift for bigger steps), Home/End for the smallest and largest size, Enter to collapse or expand. Double-click puts
 * the default width back.
 *
 * edge: which side of the handle the sidebar is on. "left" = the sidebar is to the handle's left (it grows when
 * dragged right); "right" = the sidebar is to the handle's right (it grows when dragged left).
 */
export function ResizeHandle({
  label,
  edge,
  width,
  min,
  max,
  defaultWidth,
  onResize,
  onCommit,
  onToggle,
  className,
}: {
  label: string;
  edge: "left" | "right";
  width: number;
  min: number;
  max: number;
  defaultWidth: number;
  /** Called while dragging (not saved yet). */
  onResize: (width: number) => void;
  /** Called when a drag or key press ends: save it. */
  onCommit: (width: number) => void;
  onToggle?: () => void;
  className?: string;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)));
  const fromPointer = (clientX: number) => {
    if (!start.current) return width;
    const delta = clientX - start.current.x;
    return clamp(edge === "left" ? start.current.width + delta : start.current.width - delta);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    start.current = { x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current) onResize(fromPointer(event.clientX));
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const next = fromPointer(event.clientX);
    start.current = null;
    setDragging(false);
    onCommit(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    // Arrow direction follows the screen: Right moves the divider right.
    const grow = edge === "left" ? 1 : -1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = width + step * grow;
    else if (event.key === "ArrowLeft") next = width - step * grow;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else if ((event.key === "Enter" || event.key === " ") && onToggle) {
      event.preventDefault();
      onToggle();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    onCommit(clamp(next));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label}. Drag to resize, double-click to reset${onToggle ? ", Enter to hide" : ""}.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={() => onCommit(defaultWidth)}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative z-20 w-1.5 shrink-0 cursor-col-resize touch-none select-none outline-none",
        "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-white/[0.06] before:transition-colors",
        "hover:before:w-0.5 hover:before:bg-amber-400/60 focus-visible:before:w-0.5 focus-visible:before:bg-amber-400",
        dragging && "before:w-0.5 before:bg-amber-400",
        className,
      )}
    />
  );
}
