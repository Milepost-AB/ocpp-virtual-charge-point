import { type StartTransactionFormInput, type VcpSnapshot } from "./types";
export declare const fetchVcps: () => Promise<VcpSnapshot[]>;
export declare const connectVcp: (id: string) => Promise<void>;
export declare const stopVcp: (id: string) => Promise<void>;
export declare const startTransaction: (params: {
    vcp: VcpSnapshot;
    form: StartTransactionFormInput;
}) => Promise<void>;
