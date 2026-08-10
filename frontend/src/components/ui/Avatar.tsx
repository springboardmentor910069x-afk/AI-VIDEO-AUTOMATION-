import { cn } from "@/lib/cn";

const TONES: Record<string, string> = {
  indigo: "bg-brand-600 text-white",
  slate: "bg-slate-500 text-white dark:bg-slate-600",
  emerald: "bg-emerald-600 text-white",
};

interface AvatarProps {
  name: string;
  tone?: keyof typeof TONES;
  size?: "sm" | "md";
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]!;
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export default function Avatar({ name, tone = "indigo", size = "md", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs",
        TONES[tone],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
