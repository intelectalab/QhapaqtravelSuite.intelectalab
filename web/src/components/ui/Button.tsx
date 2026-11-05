import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { omit } from "@/lib/omit";

type Variant = "primary" | "secondary" | "ghost" | "dark";
type Size = "md" | "sm";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconOnly?: boolean;
  iconOnlyOnMobile?: boolean;
  label?: string;
  children?: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps & Omit<ComponentProps<"button">, "children"> & { href?: undefined };
type LinkProps = CommonProps & { href: string; target?: string };

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg shadow-[0_6px_16px_-8px_var(--brand)] hover:brightness-110",
  secondary: "bg-surface border-[color-mix(in_srgb,var(--fg-3)_28%,transparent)] text-fg hover:bg-surface-2",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
  dark: "bg-fg text-surface hover:opacity-90",
};

const SIZES: Record<Size, { base: string; square: string }> = {
  md: { base: "h-10 px-4 rounded-control text-[13.5px] gap-2", square: "h-10 w-10 rounded-control" },
  sm: { base: "h-8 px-3 rounded-[10px] text-[13px] gap-1.5", square: "h-8 w-8 rounded-[10px]" },
};

function classes({ variant = "secondary", size = "md", iconOnly, iconOnlyOnMobile, className }: CommonProps): string {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap border border-transparent font-semibold transition disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    iconOnly ? SIZES[size].square : SIZES[size].base,
    iconOnlyOnMobile && (size === "md" ? "max-sm:w-10 max-sm:px-0" : "max-sm:w-8 max-sm:px-0"),
    className,
  );
}

export function Button(props: ButtonProps | LinkProps) {
  const { icon, iconOnly, iconOnlyOnMobile, label, children } = props;
  const content = (
    <>
      {icon}
      {!iconOnly && (iconOnlyOnMobile ? <span className="max-sm:sr-only">{children}</span> : children)}
    </>
  );
  const accessibleLabel = iconOnly ? label : undefined;

  if (props.href !== undefined) {
    return (
      <Link href={props.href} target={props.target} className={classes(props)} aria-label={accessibleLabel} title={accessibleLabel}>
        {content}
      </Link>
    );
  }

  const rest = omit(props, ["variant", "size", "iconOnly", "iconOnlyOnMobile", "label", "icon", "className", "children", "href"]);
  return (
    <button type="button" {...rest} className={classes(props)} aria-label={accessibleLabel ?? rest["aria-label"]} title={accessibleLabel}>
      {content}
    </button>
  );
}
