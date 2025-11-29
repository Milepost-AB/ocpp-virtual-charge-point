import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const alertVariants = cva(
  "w-full rounded-md border px-4 py-3 text-sm shadow-sm transition-opacity",
  {
    variants: {
      variant: {
        info: "border-sky-300 bg-sky-50 text-slate-900",
        success: "border-emerald-300 bg-emerald-50 text-slate-900",
        warning: "border-amber-300 bg-amber-50 text-slate-900",
        danger: "border-rose-300 bg-rose-50 text-slate-900",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
);
Alert.displayName = "Alert";

