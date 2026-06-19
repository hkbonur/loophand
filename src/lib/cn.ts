import { clsx, type ClassValue } from "clsx";

// Conditional Tailwind class joiner. Use the object form for conditionals:
// cn("base", { "is-active": active }).
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
