import { z } from "zod";
import { generateOCMF, getOCMFPublicKey } from "../../ocmfGenerator";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { MeterValueSchema } from "./_common";
import { statusNotificationOcppMessage } from "./statusNotification";
import { stopTransactionOcppMessage, StopTransactionReqSchema } from "./stopTransaction";

const RemoteStopTransactionReqSchema = z.object({
  transactionId: z.number().int(),
});
type RemoteStopTransactionReqType = typeof RemoteStopTransactionReqSchema;

const RemoteStopTransactionResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type RemoteStopTransactionResType = typeof RemoteStopTransactionResSchema;

class RemoteStopTransactionOcppMessage extends OcppIncoming<
  RemoteStopTransactionReqType,
  RemoteStopTransactionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RemoteStopTransactionReqType>>,
  ): Promise<void> => {
    const transactionId = call.payload.transactionId;
    const transaction = vcp.transactionManager.transactions.get(transactionId);
    const connectorsToUpdate = new Set<number>();
    vcp.respond(this.response(call, { status: "Accepted" }));

    const meterStopValue = Math.floor(
      transaction ? vcp.transactionManager.getMeterValue(transactionId) : 0,
    );

    let transactionData:
      | z.infer<typeof StopTransactionReqSchema>["transactionData"]
      | undefined;
    if (transaction) {
      connectorsToUpdate.add(transaction.connectorId);
      const ocmf = generateOCMF({
        startTime: transaction.startedAt,
        startEnergy: 0,
        endTime: new Date(),
        endEnergy: vcp.transactionManager.getMeterValue(transactionId) / 1000,
        idTag: transaction.idTag,
      });

      vcp.transactionManager.stopTransaction(transactionId);

      const sampledValue: z.infer<typeof MeterValueSchema>["sampledValue"] = [
        {
          value: JSON.stringify({
            signedMeterData: Buffer.from(ocmf).toString("base64"),
            encodingMethod: "OCMF",
            publicKey: getOCMFPublicKey().toString("base64"),
          }),
          format: "SignedData",
          context: "Transaction.End",
        },
      ];

      transactionData = [
        {
          timestamp: new Date().toISOString(),
          sampledValue,
        },
      ];
    }

    vcp.send(
      stopTransactionOcppMessage.request({
        transactionId: transactionId,
        meterStop: meterStopValue,
        timestamp: new Date().toISOString(),
        transactionData,
      }),
    );

    vcp.transactionManager.releaseAllConnectors().forEach((connectorId) =>
      connectorsToUpdate.add(connectorId),
    );

    connectorsToUpdate.forEach((connectorId) => {
      vcp.send(
        statusNotificationOcppMessage.request({
          connectorId,
          errorCode: "NoError",
          status: "Available",
        }),
      );
    });
  };
}

export const remoteStopTransactionOcppMessage =
  new RemoteStopTransactionOcppMessage(
    "RemoteStopTransaction",
    RemoteStopTransactionReqSchema,
    RemoteStopTransactionResSchema,
  );
