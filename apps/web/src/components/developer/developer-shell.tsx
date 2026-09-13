"use client";

import type { ReactNode } from "react";

/** Developer pages render their own ExperienceShell with section links, so this wrapper adds nothing visual. */
export function DeveloperShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
