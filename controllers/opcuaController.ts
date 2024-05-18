import { OPCUAClient, AttributeIds, ClientSession } from "node-opcua";
import { invokeMethod } from "./iotHubController";
import { NS, rootPath } from "../consts";

type ErrorLog = { time: number; error: number };

const opcuaClient = OPCUAClient.create({ endpointMustExist: false });

const emergencyStoppedDevices: string[] = [];
const deviceErrors: { [deviceId: string]: ErrorLog[] } = {};

export async function browseDevices(session: ClientSession): Promise<string[]> {
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

export async function updateProductionRate(
  session: ClientSession,
  deviceId: string,
  ns: number,
  newRate: number
) {
  try {
    const nodeId = `ns=${ns};s=${deviceId}/ProductionRate`;
    await session.write({
      nodeId,
      attributeId: AttributeIds.Value,
      value: { value: { dataType: "Int32", value: newRate } },
    });
    console.log(`Updated production rate for ${deviceId} to ${newRate}`);
  } catch (error) {
    console.error(`Error updating production rate for ${deviceId}:`, error);
  }
}

export async function handleDeviceError(deviceId: string, deviceData: any) {
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

export { opcuaClient, emergencyStoppedDevices };
