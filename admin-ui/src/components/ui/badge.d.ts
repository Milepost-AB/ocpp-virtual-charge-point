import { type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
declare const badgeVariants: (props?: ({
    variant?: "default" | "success" | "info" | "warning" | "danger" | "neutral" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
}
export declare const Badge: import("react").ForwardRefExoticComponent<BadgeProps & import("react").RefAttributes<HTMLDivElement>>;
export {};
