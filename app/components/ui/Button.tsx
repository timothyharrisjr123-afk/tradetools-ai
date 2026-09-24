import type { ButtonHTMLAttributes } from "react";
import {
  buttonClass,
  type ButtonSize,
  type ButtonVariant,
} from "@/app/components/ui/buttonStyles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  busy?: boolean;
  busyLabel?: string;
};

export default function Button({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  busy = false,
  busyLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, { size, fullWidth, className })}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
