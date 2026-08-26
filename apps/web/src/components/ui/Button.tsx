import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  block?: boolean
}

// Ghost-by-default: buttons are transparent until hovered, then they tint with the accent.
// Hover colours come from index.css so they adapt to the active theme.
const variants = {
  primary: 'btn-primary border border-accent text-accent active:scale-[0.99]',
  ghost: 'btn-quiet border border-line text-ink active:scale-[0.99]',
  danger: 'btn-quiet border border-line text-flame-ink active:scale-[0.99]',
}

export function Button({ variant = 'primary', block, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`min-h-[44px] rounded-xl px-4 py-3 font-semibold transition disabled:opacity-60 ${
        variants[variant]
      } ${block ? 'w-full' : ''} ${className}`}
    />
  )
}
