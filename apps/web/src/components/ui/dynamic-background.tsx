import type { ReactNode } from "react";

export function DynamicBackground({
  url,
  className = "",
  children,
}: {
  url: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{ backgroundImage: `url("${url}")` }}
    >
      {children}
    </div>
  );
}
