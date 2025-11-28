import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { statusNotificationOcppMessage } from "./statusNotification";
import {
  StopTransactionReqSchema,
  StopTransactionResSchema,
  stopTransactionOcppMessage,
} from "./stopTransaction";

class StopTransactionIncomingOcppMessage extends OcppIncoming<
  typeof StopTransactionReqSchema,
  typeof StopTransactionResSchema
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<typeof StopTransactionReqSchema>>,
  ): Promise<void> => {
    const transactionId = call.payload.transactionId;
    const transaction = vcp.transactionManager.transactions.get(transactionId);
    const connectorsToUpdate = new Set<number>();
    if (transaction) {
      connectorsToUpdate.add(transaction.connectorId);
      vcp.transactionManager.stopTransaction(transactionId);
    }

    const releasedConnectors = vcp.transactionManager.releaseAllConnectors();
    releasedConnectors.forEach((connectorId) => connectorsToUpdate.add(connectorId));

    for (const connectorId of connectorsToUpdate) {
      vcp.send(
        statusNotificationOcppMessage.request({
          connectorId,
          errorCode: "NoError",
          status: "Available",
        }),
      );
    }

    vcp.send(
      stopTransactionOcppMessage.request({
        transactionId,
        meterStop: call.payload.meterStop,
        timestamp: call.payload.timestamp,
        idTag: call.payload.idTag,
        reason: call.payload.reason,
        transactionData: call.payload.transactionData,
      }),
    );

    vcp.respond(
      this.response(call, {
        idTagInfo: {
          status: "Accepted",
        },
      }),
    );
  };
}

export const stopTransactionIncomingOcppMessage =
  new StopTransactionIncomingOcppMessage(
    "StopTransaction",
    StopTransactionReqSchema,
    StopTransactionResSchema,
  );
