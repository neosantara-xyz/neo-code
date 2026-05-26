import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

/**
 * 8-bit pixel-style button using box-shadow borders.
 * Supports both <button> and <a> via the `href` prop.
 */

type BaseProps = {
  variant?: "primary" | "default" | "ghost";
  size?: "sm" | "md" | "lg";
};

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsAnchor = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

type PixelButtonProps = ButtonAsButton | ButtonAsAnchor;

const variantStyles = {
  primary: [
    "bg-accent text-bg",
    "shadow-[inset_-4px_-4px_0px_0px_var(--accent-100),inset_4px_4px_0px_0px_var(--accent-200)]",
    "hover:brightness-110 active:shadow-[inset_4px_4px_0px_0px_var(--accent-100),inset_-4px_-4px_0px_0px_var(--accent-200)]",
  ].join(" "),
  default: [
    "bg-bg-200 text-fg",
    "shadow-[inset_-4px_-4px_0px_0px_var(--bg-300),inset_4px_4px_0px_0px_var(--bg-100)]",
    "hover:bg-bg-300 active:shadow-[inset_4px_4px_0px_0px_var(--bg-300),inset_-4px_-4px_0px_0px_var(--bg-100)]",
  ].join(" "),
  ghost: [
    "bg-transparent text-fg-300 border-2 border-border-200",
    "hover:bg-bg-100 hover:text-fg",
  ].join(" "),
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export function PixelButton(props: PixelButtonProps) {
  const { variant = "default", size = "md", className = "", ...rest } = props;
  const classes = `inline-block font-mono font-bold uppercase tracking-wider cursor-pointer select-none transition-all ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (props.href !== undefined) {
    const { href, ...anchorProps } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return <a href={href} className={classes} {...anchorProps} />;
  }

  return <button type="button" className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
