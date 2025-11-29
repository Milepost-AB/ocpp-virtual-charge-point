import type { VcpSnapshot } from "../types";
interface VcpCardProps {
    vcp: VcpSnapshot;
    onRefresh: () => void;
}
export declare const VcpCard: ({ vcp, onRefresh }: VcpCardProps) => import("react/jsx-runtime").JSX.Element;
export {};
