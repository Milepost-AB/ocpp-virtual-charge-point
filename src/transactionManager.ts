import type { VCP } from "./vcp";

const METER_VALUES_INTERVAL_SEC = 15;

type TransactionId = string | number;

interface TransactionState {
  startedAt: Date;
  idTag: string;
  transactionId: TransactionId;
  meterStart: number;
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
    TransactionState & { meterValuesTimer: NodeJS.Timeout }
  > = new Map();
  private pendingConnectors = new Set<number>();
  private connectorMeterValues = new Map<number, number>();

  canStartNewTransaction(connectorId: number) {
    const hasActiveTransaction = Array.from(this.transactions.values()).some(
      (transaction) => transaction.connectorId === connectorId,
    );
    return !hasActiveTransaction && !this.pendingConnectors.has(connectorId);
  }

  startTransaction(vcp: VCP, startTransactionProps: StartTransactionProps) {
    this.releaseConnector(startTransactionProps.connectorId);
    const meterStart = this.getConnectorMeterValue(
      startTransactionProps.connectorId,
    );
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
      meterStart,
      meterValue: meterStart,
      startedAt: new Date(),
      evseId: startTransactionProps.evseId,
      connectorId: startTransactionProps.connectorId,
      meterValuesTimer,
    });
  }

  stopTransaction(transactionId: TransactionId) {
    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      this.connectorMeterValues.set(
        transaction.connectorId,
        this.getTransactionMeterValue(transaction),
      );
      if (transaction.meterValuesTimer) {
        clearInterval(transaction.meterValuesTimer);
      }
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

  releaseAllConnectors() {
    const connectors = Array.from(this.pendingConnectors);
    this.pendingConnectors.clear();
    return connectors;
  }

  getMeterValue(transactionId: TransactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return 0;
    }
    return this.getTransactionMeterValue(transaction);
  }

  getConnectorMeterValue(connectorId: number) {
    return this.connectorMeterValues.get(connectorId) ?? 0;
  }

  private getTransactionMeterValue(transaction: TransactionState) {
    return (
      transaction.meterStart +
      (new Date().getTime() - transaction.startedAt.getTime()) / 100
    );
  }
}
