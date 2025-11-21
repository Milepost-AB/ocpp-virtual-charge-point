import type { VCP } from "./vcp";

const METER_VALUES_INTERVAL_SEC = 15;

type TransactionId = string | number;

interface TransactionState {
  startedAt: Date;
  idTag: string;
  transactionId: TransactionId;
  meterValue: number;
  evseId?: number;
  connectorId: number;
}

interface StartTransactionProps {
  transactionId: TransactionId;
  idTag: string;
  evseId?: number;
  connectorId: number;
  meterValuesCallback: (transactionState: TransactionState) => Promise<void>;
}

export class TransactionManager {
  transactions: Map<
    TransactionId,
    TransactionState & { meterValuesTimer: NodeJS.Timer }
  > = new Map();
  private pendingConnectors = new Set<number>();

  canStartNewTransaction(connectorId: number) {
    const hasActiveTransaction = Array.from(this.transactions.values()).some(
      (transaction) => transaction.connectorId === connectorId,
    );
    return !hasActiveTransaction && !this.pendingConnectors.has(connectorId);
  }

  startTransaction(vcp: VCP, startTransactionProps: StartTransactionProps) {
    this.releaseConnector(startTransactionProps.connectorId);
    const meterValuesTimer = setInterval(() => {
      // biome-ignore lint/style/noNonNullAssertion: transaction must exist
      const currentTransactionState = this.transactions.get(
        startTransactionProps.transactionId,
      )!;
      const { meterValuesTimer, ...currentTransaction } =
        currentTransactionState;
      startTransactionProps.meterValuesCallback({
        ...currentTransaction,
        meterValue: this.getMeterValue(startTransactionProps.transactionId),
      });
    }, METER_VALUES_INTERVAL_SEC * 1000);
    this.transactions.set(startTransactionProps.transactionId, {
      transactionId: startTransactionProps.transactionId,
      idTag: startTransactionProps.idTag,
      meterValue: 0,
      startedAt: new Date(),
      evseId: startTransactionProps.evseId,
      connectorId: startTransactionProps.connectorId,
      meterValuesTimer: meterValuesTimer,
    });
  }

  stopTransaction(transactionId: TransactionId) {
    const transaction = this.transactions.get(transactionId);
    if (transaction?.meterValuesTimer) {
      clearInterval(transaction.meterValuesTimer);
    }
    this.transactions.delete(transactionId);
  }

  reserveConnector(connectorId: number) {
    if (!this.canStartNewTransaction(connectorId)) {
      return false;
    }
    this.pendingConnectors.add(connectorId);
    return true;
  }

  releaseConnector(connectorId: number) {
    this.pendingConnectors.delete(connectorId);
  }

  getMeterValue(transactionId: TransactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return 0;
    }
    return (new Date().getTime() - transaction.startedAt.getTime()) / 100;
  }
}
