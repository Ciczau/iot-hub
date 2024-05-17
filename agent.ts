import {
  AttributeIds,
  ClientSession,
  ClientSubscription,
  OPCUAClient,
  TimestampsToReturn,
} from "node-opcua";

import { Client, Message } from "azure-iot-device";
import { Mqtt } from "azure-iot-device-mqtt";
import { Client as AzureClient } from "azure-iothub";

const deviceConnectionString =
  "HostName=ZajeciaWMII.azure-devices.net;DeviceId=test_device;SharedAccessKey=vZ6b5rgwh9jzhDRdVuK4rXSfV2l9LFrXHAIoTHe87pg=";

const deviceClient = Client.fromConnectionString(deviceConnectionString, Mqtt);
const opcuaClient = OPCUAClient.create({ endpointMustExist: false });
const opcuaEndpointUrl = "opc.tcp://localhost:4840";
const NS = 2;
const rootPath = "RootFolder";
const iotHubConnectionString =
  "HostName=ZajeciaWMII.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=wglxzi1SnE11spj/Js4QlM44PQLP/KZ8FAIoTGrYxKc=";
const iotHubClient = AzureClient.fromConnectionString(iotHubConnectionString);

type ErrorLog = { time: number; error: number };

async function browseDevices(session: ClientSession): Promise<string[]> {
  try {
    const rootBrowseResult = await session.browse(rootPath);
    const objectsFolder = rootBrowseResult.references?.find(
      (ref) => ref.browseName.name === "Objects"
    );
    const browsePath = `ns=${objectsFolder?.nodeId.namespace};i=${objectsFolder?.nodeId.value}`;
    const browseResult = await session.browse(browsePath);

    const devices = browseResult.references
      ?.filter((ref) => ref.nodeId.namespace === NS)
      .map((ref) => ref.browseName.name);

    return (devices as string[]) || [];
  } catch (error) {
    console.error("Error browsing devices:", error);
    return [];
  }
}

const deviceErrors: { [deviceId: string]: ErrorLog[] } = {};
const emergencyStoppedDevices: string[] = [];

function logError(deviceId: string, errorCode: number) {
  const now = Date.now();
  if (!deviceErrors[deviceId]) {
    deviceErrors[deviceId] = [];
  }

  deviceErrors[deviceId].push({ time: now, error: errorCode });

  // Delete errors older than 1 minute
  deviceErrors[deviceId] = deviceErrors[deviceId].filter(
    (e) => now - e.time < 60000
  );

  // Check if there are 3 different errors in the last minute
  const errorSet = new Set(deviceErrors[deviceId].map((e) => e.error));
  return (
    (errorSet.has(2) && errorSet.has(4) && errorSet.has(8)) ||
    (errorSet.has(6) && errorSet.has(8)) ||
    (errorSet.has(2) && errorSet.has(12)) ||
    (errorSet.has(4) && errorSet.has(10))
  );
}

async function handleDeviceError(deviceId: string, deviceData: any) {
  if (deviceData.deviceError && deviceData.deviceError !== 0) {
    if (logError(deviceId, deviceData.deviceError)) {
      console.log("Three different errors detected in the last minute");
      emergencyStoppedDevices.push(deviceId);
      await invokeMethod(deviceId, "EmergencyStop");
    }

    if (deviceData.deviceError === 14) {
      console.log("Immediate EmergencyStop due to error 14");
      emergencyStoppedDevices.push(deviceId);
      await invokeMethod(deviceId, "EmergencyStop");
    }
  }
}

async function invokeMethod(deviceId: string, method: string) {
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

async function monitorDevice(
  session: ClientSession,
  subscription: ClientSubscription,
  deviceId: string,
  ns: number
) {
  const nodeIds = {
    temperature: `ns=${ns};s=${deviceId}/Temperature`,
    productionRate: `ns=${ns};s=${deviceId}/ProductionRate`,
    goodCount: `ns=${ns};s=${deviceId}/GoodCount`,
    badCount: `ns=${ns};s=${deviceId}/BadCount`,
    productionStatus: `ns=${ns};s=${deviceId}/ProductionStatus`,
    workorderId: `ns=${ns};s=${deviceId}/WorkorderId`,
    deviceError: `ns=${ns};s=${deviceId}/DeviceError`,
    emergencyStop: `ns=${ns};s=${deviceId}/EmergencyStop`,
  };

  const deviceData: { [key: string]: any } = { deviceId };

  for (const [key, nodeId] of Object.entries(nodeIds)) {
    try {
      const monitoredItem = await subscription.monitor(
        { nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: 1000, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Both
      );

      monitoredItem.on("changed", async (dataValue) => {
        let value = dataValue.value.value;

        if (Array.isArray(value)) {
          //handle array values from goodCount and badCount
          value = value[1];
        }
        deviceData[key] = value;

        const message = new Message(JSON.stringify(deviceData));

        try {
          await deviceClient.sendEvent(message);
          console.log(
            `Sent data for ${deviceId} to IoT Hub: ${JSON.stringify(
              deviceData
            )}`
          );
        } catch (err) {
          console.error(`Error sending data for ${deviceId} to IoT Hub`, err);
        }

        if (
          deviceData &&
          deviceData.deviceError !== 1 &&
          !emergencyStoppedDevices.includes(deviceId)
        ) {
          await handleDeviceError(deviceId, deviceData);
        }
      });
    } catch (err) {
      console.error(`Error monitoring node ${nodeId} for ${deviceId}:`, err);
    }
  }
}

async function main() {
  try {
    await opcuaClient.connect(opcuaEndpointUrl);
    const session = await opcuaClient.createSession();

    const subscription = await session.createSubscription2({
      requestedPublishingInterval: 1000,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 10,
      publishingEnabled: true,
      priority: 10,
    });

    const devices = (await browseDevices(session)) || [];

    for (const device of devices) {
      await monitorDevice(session, subscription, device, NS);
    }
  } catch (err) {
    console.error("Error in OPC UA client setup:", err);
  }
}

main();
