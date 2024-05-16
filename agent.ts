import {
  AttributeIds,
  ClientSession,
  ClientSubscription,
  OPCUAClient,
  TimestampsToReturn,
} from "node-opcua";

const opcuaClient = OPCUAClient.create({ endpointMustExist: false });
const opcuaEndpointUrl = "opc.tcp://localhost:4840";
const NS = 2;

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

  for (const [key, nodeId] of Object.entries(nodeIds)) {
    try {
      const monitoredItem = await subscription.monitor(
        { nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: 1000, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Both
      );

      monitoredItem.on("changed", async (dataValue) => {
        console.log(`Data value changed for ${nodeId}:`, dataValue.value.value);
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

    await monitorDevice(session, subscription, "Device 1", NS);
  } catch (err) {
    console.error("Error in OPC UA client setup:", err);
  }
}

main();
