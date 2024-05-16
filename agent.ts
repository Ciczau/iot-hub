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
const rootPath = "RootFolder";

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

    const devices = (await browseDevices(session)) || [];

    for (const device of devices) {
      await monitorDevice(session, subscription, device, NS);
    }
  } catch (err) {
    console.error("Error in OPC UA client setup:", err);
  }
}

main();
