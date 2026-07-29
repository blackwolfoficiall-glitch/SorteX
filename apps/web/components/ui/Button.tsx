import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-violet-600 text-white hover:bg-violet-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-slate-300 bg-white hover:bg-slate-50",
        secondary: "bg-slate-100 text-slate-950 hover:bg-slate-200",
        ghost: "hover:bg-slate-100",
        link: "text-violet-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export default Button;
