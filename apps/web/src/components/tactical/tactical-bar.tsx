"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TacticalBarProps {
  value: number | string;
  className?: string;
  color?: string;
}

export function TacticalBar({ value, className, color = "bg-amber-500" }: TacticalBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current) {
      const width = typeof value === "number" ? `${value}%` : value;
      barRef.current.style.width = width;
    }
  }, [value]);

  return (
    <div className={cn("h-full relative overflow-hidden", className)}>
      <div 
        ref={barRef} 
        className={cn("h-full transition-all duration-700", color)} 
      />
    </div>
  );
}
