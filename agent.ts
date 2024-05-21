import {
  opcuaClient,
  browseDevices,
  updateProductionRate,
  handleDeviceError,
  emergencyStoppedDevices,
} from "./controllers/opcuaController";
import {
  deviceClients,
  invokeMethod,
  updateTwin,
} from "./controllers/iotHubController";
import { sendEmailNotification } from "./controllers/emailController";
import {
  ClientSession,
  ClientSubscription,
  TimestampsToReturn,
  AttributeIds,
} from "node-opcua";
import {
  DeviceMethodRequest,
  DeviceMethodResponse,
  Message,
  Twin,
} from "azure-iot-device";
import { NS, opcuaEndpointUrl } from "./consts";

const deviceTwins: { [deviceId: string]: Twin } = {};
const productionRateDecreasedTimes: { [deviceId: string]: number } = {};

const handleDeviceUpdate = async (
  twin: Twin,
  key: string,
  value: string | number,
  deviceId: string,
  azureDeviceId: string,
  deviceData: { [key: string]: any },
  session: ClientSession
) => {
  if (key === "productionRate" || key === "deviceError") {
    updateTwin(twin, key, value);
  }
  if (
    emergencyStoppedDevices.includes(azureDeviceId) &&
    deviceData.productionStatus === 1
  ) {
    const index = emergencyStoppedDevices.indexOf(azureDeviceId);
    emergencyStoppedDevices.splice(index, 1);
    await invokeMethod(azureDeviceId, "ResetErrorStatus");
  }

  if (
    deviceData &&
    deviceData.deviceError !== 1 &&
    !emergencyStoppedDevices.includes(azureDeviceId)
  ) {
    await handleDeviceError(azureDeviceId, deviceData);
  }

  if (
    typeof deviceData.goodCount === "number" &&
    typeof deviceData.badCount === "number" &&
    typeof deviceData.productionRate === "number" &&
    deviceData.productionStatus === 1
  ) {
    const now = Date.now();
    const totalProduction = deviceData.goodCount + deviceData.badCount;
    if (totalProduction > 0) {
      const goodProductionRate = (deviceData.goodCount / totalProduction) * 100;
      // console.log(
      //   `Good production rate for ${deviceId}: ${goodProductionRate.toFixed(
      //     2
      //   )}%`
      // );
      if (
        goodProductionRate < 90 &&
        (now - productionRateDecreasedTimes[deviceId] > 30000 || //TODO: Idk what interval should be here
          !productionRateDecreasedTimes[deviceId])
      ) {
        console.log(
          `Decreasing production rate for ${deviceId} due to low good production rate`
        );
        deviceData.productionRate = Math.max(deviceData.productionRate - 10, 0);

        productionRateDecreasedTimes[deviceId] = now;

        await updateProductionRate(
          session,
          deviceId,
          NS,
          deviceData.productionRate
        );
      }
    }
  }
};

async function monitorDevice(
  session: ClientSession,
  subscription: ClientSubscription,
  deviceId: string,
  azureDeviceId: string,
  ns: number,
  deviceClient: any
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
  let lastErrorSent: number = 0;
  let twin = deviceTwins[deviceId];

  deviceClient.getTwin((err: any, deviceTwin?: Twin) => {
    if (err) {
      console.error("Error getting device twin: ", err);
      return;
    }
    if (!deviceTwin) return;

    console.log("Twin retrieved successfully");
    twin = deviceTwin;
    deviceTwins[deviceId] = twin;

    deviceTwin.on("properties.desired", (desiredChange: any) => {
      console.log("Desired properties changed:", desiredChange);
      if (desiredChange.productionRate !== undefined) {
        updateProductionRate(
          session,
          deviceId,
          ns,
          desiredChange.productionRate
        );
        updateTwin(twin, "productionRate", desiredChange.productionRate);
      }
    });
  });

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
          // console.log(
          //   `Sent data for ${deviceId} to IoT Hub: ${JSON.stringify(
          //     deviceData
          //   )}`
          // );
        } catch (err) {
          console.error(`Error sending data for ${deviceId} to IoT Hub`, err);
        }

        try {
          await handleDeviceUpdate(
            twin,
            key,
            value,
            deviceId,
            azureDeviceId,
            deviceData,

            session
          );
          if (
            deviceData.deviceError !== lastErrorSent &&
            deviceData.deviceError !== null &&
            deviceData.deviceError !== 0
          ) {
            lastErrorSent = deviceData.deviceError;
            await sendEmailNotification(deviceId, deviceData.deviceError);
          }
        } catch (err) {
          console.error(`Error handling device update for ${deviceId}`, err);
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

    for (const deviceClient of deviceClients) {
      if (devices.includes(deviceClient.deviceId)) {
        monitorDevice(
          session,
          subscription,
          deviceClient.deviceId,
          deviceClient.azureDeviceId,
          NS,
          deviceClient.client
        );
      }
      deviceClient.client.onDeviceMethod("EmergencyStop", (request, response) =>
        onDirectMethod(request, response, deviceClient.deviceId)
      );
      deviceClient.client.onDeviceMethod(
        "ResetErrorStatus",
        (request, response) =>
          onDirectMethod(request, response, deviceClient.deviceId)
      );
    }
  } catch (err) {
    console.error("Error in OPC UA client setup:", err);
  }
}

main();

async function onDirectMethod(
  request: DeviceMethodRequest,
  response: DeviceMethodResponse,
  deviceId: string
) {
  console.log(`Received method call for method: ${request.methodName}`);
  console.log(request);
  try {
    const session = await opcuaClient.createSession();
    const methodId = `ns=${NS};s=${deviceId}/${request.methodName}`;
    const objectId = `ns=${NS};s=${deviceId}`;

    const result = await session.call({
      objectId,
      methodId,
    });

    console.log(`${request.methodName} result: ${result}`);

    // Send response back to IoT Hub
    response.send(200, `${request.methodName} executed`, (err) => {
      if (err) {
        console.error("Failed to send method response:", err);
      } else {
        console.log("Successfully sent method response.");
      }
    });
  } catch (error) {
    console.error(
      `Error executing ${request.methodName} for ${deviceId}:`,
      error
    );
    response.send(
      500,
      `Error executing ${request.methodName} for ${deviceId}`,
      (err) => {
        if (err) {
          console.error("Failed to send error response:", err);
        }
      }
    );
  }
}
