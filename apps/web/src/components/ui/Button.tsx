import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  block?: boolean
}

const variants = {
  primary: 'bg-accent text-white active:scale-[0.99]',
  ghost: 'border border-line bg-surface text-ink active:scale-[0.99]',
  danger: 'border border-line bg-surface text-flame-ink active:scale-[0.99]',
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
