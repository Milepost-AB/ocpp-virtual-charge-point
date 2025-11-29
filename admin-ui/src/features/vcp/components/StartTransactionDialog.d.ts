import { type VcpSnapshot } from "../types";
interface StartTransactionDialogProps {
    vcp: VcpSnapshot;
    onSuccess: () => void;
}
export declare const StartTransactionDialog: ({ vcp, onSuccess, }: StartTransactionDialogProps) => import("react/jsx-runtime").JSX.Element;
export {};
