import { Client, Twin } from "azure-iot-device";
import { Client as AzureClient } from "azure-iothub";
import { Mqtt } from "azure-iot-device-mqtt";
import { deviceConnectionString, iotHubConnectionString } from "../consts";

const deviceClient = Client.fromConnectionString(deviceConnectionString, Mqtt);
const iotHubClient = AzureClient.fromConnectionString(iotHubConnectionString);

export async function updateTwin(
  twin: Twin,
  key: string,
  value: string | number,
  deviceId: string
) {
  if (!twin) return;
  const patch = {
    [deviceId.replace(/\s+/g, "")]: {
      [key]: value,
    },
  };

  twin.properties.reported.update(patch, (err: Error | undefined) => {
    if (err) {
      console.error(`Error updating twin`);
    } else {
      console.log(`Twin state reported: ${JSON.stringify(patch)}`);
    }
  });
}

export async function invokeMethod(deviceId: string, method: string) {
  const methodParams = {
    methodName: method,
    payload: { deviceId },
  };
  iotHubClient.invokeDeviceMethod(
    "test_device",
    methodParams,
    (err, result) => {
      if (err) {
        console.error(`Error invoking ${method} for ${deviceId}`, err);
      } else {
        console.log(
          `${method} invoked for ${deviceId}: ${JSON.stringify(result)}`
        );
      }
    }
  );
}

export { deviceClient };
