import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-neon-cyan/20 to-neon-violet/20 border border-neon-cyan/40 text-neon-cyan hover:shadow-glow-cyan hover:border-neon-cyan/70',
        solid:
          'bg-neon-cyan text-void font-semibold hover:bg-neon-cyan/85 hover:shadow-glow-cyan',
        ghost: 'text-slate-300 hover:bg-panel-2 hover:text-slate-100',
        outline:
          'border border-line text-slate-300 hover:border-neon-violet/50 hover:text-neon-violet',
        danger:
          'border border-neon-red/40 text-neon-red hover:bg-neon-red/10 hover:shadow-[0_0_18px_rgba(251,113,133,0.25)]',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
