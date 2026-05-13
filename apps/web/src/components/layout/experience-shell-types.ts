export type ExperienceMetric = {
  label: string;
  value: string;
  tone?: "cyan" | "emerald" | "amber" | "slate";
};

export type ExperienceAction = {
  label: string;
  href: string;
  tone?: "primary" | "ghost";
};
