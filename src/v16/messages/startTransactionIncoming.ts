import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, IdTokenSchema } from "./_common";
import { startTransactionOcppMessage } from "./startTransaction";
import { statusNotificationOcppMessage } from "./statusNotification";

const StartTransactionIncomingReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  idTag: IdTokenSchema,
  meterStart: z.number().int(),
  reservationId: z.number().int().nullish(),
  timestamp: z.string().datetime(),
});
type StartTransactionIncomingReqType = typeof StartTransactionIncomingReqSchema;

const StartTransactionIncomingResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: z.string().max(255).nullish(),
});
type StartTransactionIncomingResType = typeof StartTransactionIncomingResSchema;

class StartTransactionIncomingOcppMessage extends OcppIncoming<
  StartTransactionIncomingReqType,
  StartTransactionIncomingResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<StartTransactionIncomingReqType>>,
  ): Promise<void> => {
    const { connectorId } = call.payload;
    if (!vcp.transactionManager.reserveConnector(connectorId)) {
      vcp.respond(
        this.response(call, {
          status: "Rejected",
          statusInfo: "Connector already in use",
        }),
      );
      return;
    }

    vcp.respond(this.response(call, { status: "Accepted" }));

    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId,
        errorCode: "NoError",
        status: "Charging",
      }),
    );

    vcp.send(
      startTransactionOcppMessage.request({
        connectorId,
        idTag: call.payload.idTag,
        meterStart: call.payload.meterStart,
        reservationId: call.payload.reservationId,
        timestamp: call.payload.timestamp,
      }),
    );
  };
}

export const startTransactionIncomingOcppMessage =
  new StartTransactionIncomingOcppMessage(
    "StartTransaction",
    StartTransactionIncomingReqSchema,
    StartTransactionIncomingResSchema,
  );
