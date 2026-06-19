import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

interface Props {
  className?: string;
}

export function Spinner(props: Props) {
  return (
    <Loader2 className={cn("h-4 w-4 animate-spin text-[var(--sea-ink-soft)]", props.className)} />
  );
}
