"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface RevealSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
}

export function RevealSection({ children, className = "", delay = 80, threshold = 0.18 }: RevealSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, visible]);

  const delayClass = delay === 0 ? "delay-0" : delay <= 150 ? "delay-150" : delay <= 250 ? "delay-200" : "delay-300";

  return (
    <div ref={ref} className={`${className} reveal-section ${delayClass}${visible ? " visible" : ""}`}>
      {children}
    </div>
  );
}
