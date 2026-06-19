import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "../lib/cn";

interface Props {
  className?: string;
}

export function Spinner(props: Props) {
  return (
    <CircleNotch weight="bold" className={cn("h-4 w-4 animate-spin", props.className)} />
  );
}
