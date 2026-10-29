import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

/** 2px ink focus outline with offset, defined once in styles/index.css. */
export const focusRing = 'focus-ring'

export type ButtonVariant = 'primary' | 'secondary' | 'ink'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-alert text-ink',
  secondary: 'bg-paper text-ink',
  ink: 'bg-ink text-paper',
}

const BASE_CLASS =
  'inline-flex items-center justify-center gap-2 border-[3px] border-ink font-display font-bold leading-none shadow-[5px_5px_0_0_var(--color-ink)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[7px_7px_0_0_var(--color-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-40 ' +
  focusRing

function buttonClass(variant: ButtonVariant = 'primary', className = ''): string {
  return `${BASE_CLASS} ${VARIANT_CLASS[variant]} ${className}`.trim()
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...rest}>
      {children}
    </button>
  )
}

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
}

export function ButtonLink({ variant = 'primary', className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, className)} {...rest}>
      {children}
    </Link>
  )
}
