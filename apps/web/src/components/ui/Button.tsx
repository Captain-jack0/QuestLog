import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  block?: boolean
}

// Primary is the one filled control: accent ground, paper text (5.8:1 quest, 6.9:1 calm). Its
// hover brightens rather than recolours, which reads the same in both themes: contrast rises to
// ~6.5:1 in quest and eases to ~6.3:1 in calm, AA either way. The other variants stay ghost —
// transparent until hovered, with hover colours from index.css so they adapt to the active theme.
export const variants = {
  primary:
    'border border-accent bg-accent text-paper enabled:hover:brightness-110 active:scale-[0.99]',
  ghost: 'btn-quiet border border-line text-ink active:scale-[0.99]',
  danger: 'btn-danger border border-line text-alert-ink active:scale-[0.99]',
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
