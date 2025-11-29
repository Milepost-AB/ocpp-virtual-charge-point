# OCPP Virtual Charge Point

Simple, configurable, terminal-based OCPP Charging Station simulator written in Node.js with Schema validation.

## Watch our video introduction

[![VCP Video](https://img.youtube.com/vi/YsXjnk0mhfA/0.jpg)](https://www.youtube.com/watch?v=YsXjnk0mhfA)

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure virtual charge points

   The runtime looks for `config/vcps.json` (or a file pointed to by `VCP_CONFIG_FILE`).  
   Use the provided sample as a starting point:

   ```bash
   cp config/vcps.example.json config/vcps.json
   ```

   Each file contains:

   ```json
   {
     "admin": { "port": 9999 },
     "defaults": {
       "endpoint": "ws://localhost:8092",
       "basicAuthPassword": "secret"
     },
     "vcps": [
       {
         "id": "CP-001",
         "ocppVersion": "OCPP_1.6",
         "endpoint": "ws://central-system:3000",
         "chargePointSerialNumber": "CP-001-S001",
         "autoBoot": {
           "enabled": true,
           "chargePointVendor": "Solidstudio",
           "chargePointModel": "VirtualChargePoint",
           "firmwareVersion": "1.0.0",
           "connectorsPerChargePoint": 2
         },
         "metadata": {
           "site": "HQ"
         }
       }
     ]
   }
   ```

   - `admin.port` determines where the shared Admin API is exposed.
   - `defaults` seed properties for every VCP when omitted per entry.
   - Each object in `vcps` creates one managed `VCP` instance (with its own `chargePointId`, OCPP version, credentials, and auto-boot behaviour).

3. (Optional) Environment fallback

   If the config file is missing we fall back to the previous env-based behaviour.  
   The following variables are honoured:

   | Variable | Description |
   | --- | --- |
   | `WS_URL` | Central system websocket URL |
   | `CP_IDS` / `CP_ID` | Comma separated list (or single id) of charge point ids |
   | `PASSWORD` | Basic auth password |
   | `OCPP_VERSION` | `OCPP_1.6`, `OCPP_2.0.1`, or `OCPP_2.1` |
   | `FIRMWARE_VERSION`, `CHARGE_POINT_VENDOR`, `CHARGE_POINT_MODEL` | Boot metadata |
   | `CONNECTORS_PER_CP` | Number of connectors per charge point |
   | `ADMIN_PORT` / `ADMIN_WS_PORT` | Admin API port |

## Run the unified entrypoint

```bash
npm run start
```

or run directly with tsx:

```bash
VCP_CONFIG_FILE=./config/my-vcps.json npx tsx src/main.ts
```

The process boots every configured VCP, automatically sends Boot/Status notifications (when `autoBoot.enabled` is true), and starts the shared Admin API server.

## Example log output

```bash
> WS_URL=ws://localhost:8092 CP_ID=vcp_16_test npx tsx src/main.ts

2023-03-27 13:09:17 info: Connecting... | {
  endpoint: 'ws://localhost:8092',
  chargePointId: 'vcp_16_test',
  ocppVersion: 'OCPP_1.6',
  basicAuthPassword: 'password',
  adminWsPort: 9999
}
2023-03-27 13:09:17 info: Sending message ➡️  [2,"5fe44756-05e1-4065-9c91-11b456b55913","BootNotification",{"chargePointVendor":"Solidstudio","chargePointModel":"test","chargePointSerialNumber":"S001","firmwareVersion":"1.0.0"}]
2023-03-27 13:09:17 info: Sending message ➡️  [2,"aad8d05d-3a6b-4c51-a9fc-7275d4a6cbc3","StatusNotification",{"connectorId":1,"errorCode":"NoError","status":"Available"}]
2023-03-27 13:09:17 info: Receive message ⬅️  [3,"5fe44756-05e1-4065-9c91-11b456b55913",{"currentTime":"2023-03-27T11:09:17.883Z","interval":30,"status":"Accepted"}]
2023-03-27 13:09:17 info: Receive message ⬅️  [2,"658c8f5b-9f86-487f-91f8-1d656453978a","ChangeConfiguration",{"key":"MeterValueSampleInterval","value":"60"}]
2023-03-27 13:09:17 info: Responding with ➡️  [3,"658c8f5b-9f86-487f-91f8-1d656453978a",{"status":"Accepted"}]
2023-03-27 13:09:17 info: Receive message ⬅️  [2,"34fc4673-deff-48d3-bb8e-d94d75fa619a","GetConfiguration",{"key":["SupportedFeatureProfiles"]}]
2023-03-27 13:09:17 info: Responding with ➡️  [3,"34fc4673-deff-48d3-bb8e-d94d75fa619a",{"configurationKey":[{"key":"SupportedFeatureProfiles","readonly":true,"value":"Core,FirmwareManagement,LocalAuthListManagement,Reservation,SmartCharging,RemoteTrigger"},{"key":"ChargeProfileMaxStackLevel","readonly":true,"value":"99"},{"key":"HeartbeatInterval","readonly":false,"value":"300"},{"key":"GetConfigurationMaxKeys","readonly":true,"value":"99"}]}]
2023-03-27 13:09:17 info: Receive message ⬅️  [3,"aad8d05d-3a6b-4c51-a9fc-7275d4a6cbc3",{}]
2023-03-27 13:09:18 info: Receive message ⬅️  [2,"d7610ad2-63d0-470f-9bd9-6e47d5483429","SetChargingProfile",{"connectorId":0,"csChargingProfiles":{"chargingProfileId":30,"stackLevel":0,"chargingProfilePurpose":"ChargePointMaxProfile","chargingProfileKind":"Absolute","chargingSchedule":{"chargingRateUnit":"A","chargingSchedulePeriod":[{"startPeriod":0,"limit":10.0}]}}}]
2023-03-27 13:09:18 info: Responding with ➡️  [3,"d7610ad2-63d0-470f-9bd9-6e47d5483429",{"status":"Accepted"}]
2023-03-27 13:10:17 info: Sending message ➡️  [2,"79a41b2e-2c4a-4a65-9d7e-417967a8f95f","Heartbeat",{}]
2023-03-27 13:10:17 info: Receive message ⬅️  [3,"79a41b2e-2c4a-4a65-9d7e-417967a8f95f",{"currentTime":"2023-03-27T11:10:17.955Z"}]
```

## Admin API

The new Admin API exposes a single HTTP server (default `http://localhost:9999`) with JSON endpoints:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Basic readiness probe |
| `GET` | `/vcp` | List all managed VCPs with their current status |
| `GET` | `/vcp/:id` | Inspect a single VCP |
| `POST` | `/vcp` | Create a new VCP (body mirrors the config format) |
| `PATCH` | `/vcp/:id` | Update metadata, credentials, or autoBoot settings |
| `POST` | `/vcp/:id/connect` | Connect (or reconnect) a VCP |
| `POST` | `/vcp/:id/stop` | Gracefully stop/close a VCP session |
| `POST` | `/vcp/:id/action` | Proxy an arbitrary OCPP action + payload |
| `DELETE` | `/vcp/:id` | Stop and remove a VCP from the manager |

Example – list all VCPs:

```bash
curl http://localhost:9999/vcp | jq
```

Example – trigger a RemoteStartTransaction action:

```bash
curl -X POST http://localhost:9999/vcp/CP-001/action \
  -H "Content-Type: application/json" \
  -d '{"action":"RemoteStartTransaction","payload":{"connectorId":1,"idTag":"ABC123"}}'
```

You can wire any UI or script against this API without spinning extra admin servers inside each VCP instance.

## Admin UI (beta)

Looking for a quick way to inspect VCPs and queue actions without `curl`?  
Build the bundled React UI and let the Admin server host it:

```bash
npm run admin-ui:build
npm start
# visit http://localhost:9999/
```

Development, configuration, and architectural notes live in [ADMIN_UI.md](./ADMIN_UI.md).

---

## Contributing

### Bug Reports & Feature Requests

Please use the [issue tracker](https://github.com/solidstudiosh/ocpp-virtual-charge-point/issues) to report any bugs or file feature requests.

### Developing

We encourage contributions through pull requests and follow the standard "fork-and-pull" git workflow. Feel free to create a fork of the repository, make your changes, and submit a pull request for review. We appreciate your contributions!

1. Fork the repository on GitHub.
2. Clone the forked repository to your local machine.
3. Create a new branch for your changes.
4. Make your changes to the code and commit them to your local branch.
5. Push the changes to your forked repository on GitHub.
6. Create a new pull request on the original repository.
7. Wait for feedback and make any necessary changes.
8. Once your pull request has been reviewed and accepted, it will be merged into the original repository.

When creating your pull request, please include a clear description of the changes you have made, and any relevant context or reasoning behind those changes.
