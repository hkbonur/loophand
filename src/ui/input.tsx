import { cn } from "../lib/cn";

type Size = "md" | "lg";

interface Props {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  placeholder?: string;
  size?: Size;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}

const SIZE_CLASSES: Record<Size, string> = {
  md: "h-10 text-sm",
  lg: "h-11 text-sm",
};

export function Input(props: Props) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      placeholder={props.placeholder}
      disabled={props.disabled}
      required={props.required}
      autoComplete={props.autoComplete}
      className={cn(
        "w-full rounded-full border border-input bg-muted px-4 text-foreground transition",
        "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_CLASSES[props.size ?? "md"],
        props.className,
      )}
    />
  );
}
