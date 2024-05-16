import { OPCUAClient } from "node-opcua";

const opcuaClient = OPCUAClient.create({ endpointMustExist: false });
const opcuaEndpointUrl = "opc.tcp://localhost:4840";

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
  } catch (err) {
    console.error("Error in OPC UA client setup:", err);
  }
}

main();
