import { CircleNotchIcon } from "@phosphor-icons/react";
import { cn } from "../lib/cn";

interface Props {
  className?: string;
}

export function Spinner(props: Props) {
  return (
    <CircleNotchIcon weight="bold" className={cn("h-4 w-4 animate-spin", props.className)} />
  );
}
