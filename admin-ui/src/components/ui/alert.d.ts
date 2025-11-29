import { type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
declare const alertVariants: (props?: ({
    variant?: "success" | "info" | "warning" | "danger" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
}
export declare const Alert: import("react").ForwardRefExoticComponent<AlertProps & import("react").RefAttributes<HTMLDivElement>>;
export {};
