require("dotenv").config();

import { once } from "node:events";

import { OcppVersion } from "./src/ocppVersion";
import { bootNotificationOcppMessage } from "./src/v16/messages/bootNotification";
import { statusNotificationOcppMessage } from "./src/v16/messages/statusNotification";
import { VCP } from "./src/vcp";

const DEFAULT_CHARGE_POINT_IDS = ["CP-001", "CP-002", "CP-003"];

const resolvedChargePointIds = (
  process.env.CP_IDS ?? DEFAULT_CHARGE_POINT_IDS.join(",")
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const chargePointIds =
  resolvedChargePointIds.length > 0
    ? resolvedChargePointIds
    : DEFAULT_CHARGE_POINT_IDS;

const endpoint = process.env.WS_URL ?? "ws://localhost:3000";
const basicAuthPassword = process.env.PASSWORD ?? undefined;
const firmwareVersion = process.env.FIRMWARE_VERSION ?? "1.0.0";
const chargePointVendor = process.env.CHARGE_POINT_VENDOR ?? "Solidstudio";
const chargePointModel =
  process.env.CHARGE_POINT_MODEL ?? "VirtualChargePoint";

const parsedConnectorCount = Number.parseInt(
  process.env.CONNECTORS_PER_CP ?? "2",
  10,
);
const connectorsPerChargePoint =
  Number.isNaN(parsedConnectorCount) || parsedConnectorCount < 1
    ? 1
    : parsedConnectorCount;

interface ChargePointContext {
  id: string;
  serialNumber: string;
  vcp: VCP;
}

const chargePoints: ChargePointContext[] = chargePointIds.map(
  (chargePointId, index) => {
    const serialNumber = `${chargePointId}-S${String(index + 1).padStart(
      3,
      "0",
    )}`;
    console.log(
      `Creating VCP for charge point ${chargePointId} with serial number ${serialNumber}`,
    );
    return {
      id: chargePointId,
      serialNumber,
      vcp: new VCP({
        endpoint,
        chargePointId,
        ocppVersion: OcppVersion.OCPP_1_6,
        basicAuthPassword,
      }),
    };
  },
);

const bootChargePoint = async (chargePoint: ChargePointContext) => {
  await chargePoint.vcp.connect();
  const bootAcceptedPromise = once(chargePoint.vcp, "BootNotificationAccepted");
  chargePoint.vcp.send(
    bootNotificationOcppMessage.request({
      chargePointVendor,
      chargePointModel,
      chargePointSerialNumber: chargePoint.serialNumber,
      firmwareVersion,
    }),
  );
  await bootAcceptedPromise;

  const sendStatus = (connectorId: number) =>
    chargePoint.vcp.send(
      statusNotificationOcppMessage.request({
        connectorId,
        errorCode: "NoError",
        status: "Available",
      }),
    );

  sendStatus(0);

  for (
    let connectorId = 1;
    connectorId <= connectorsPerChargePoint;
    connectorId += 1
  ) {
    sendStatus(connectorId);
  }
};

(async () => {
  await Promise.all(chargePoints.map((chargePoint) => bootChargePoint(chargePoint)));
})();
