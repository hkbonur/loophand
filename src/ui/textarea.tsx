import { cn } from "../lib/cn";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function Textarea(props: Props) {
  return (
    <textarea
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      placeholder={props.placeholder}
      rows={props.rows ?? 3}
      className={cn(
        "w-full resize-y rounded-2xl border border-input bg-muted px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground focus:border-primary focus:outline-none",
        props.className,
      )}
    />
  );
}
