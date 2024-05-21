import { Client } from "azure-iot-device";
import { Mqtt } from "azure-iot-device-mqtt";
import { deviceConnectionString1, deviceConnectionString2 } from "./consts";
export const deviceClients = [
  {
    deviceId: "Device 1",
    azureDeviceId: "Device1",
    client: Client.fromConnectionString(deviceConnectionString1, Mqtt),
  },
  {
    deviceId: "Device 2",
    azureDeviceId: "Device2",
    client: Client.fromConnectionString(deviceConnectionString2, Mqtt),
  },
];
