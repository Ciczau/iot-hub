import { EmailClient } from "@azure/communication-email";
import { emailConnectionString } from "../consts";

const emailClient = new EmailClient(emailConnectionString);

export async function sendEmailNotification(
  deviceId: string,
  errorCode: number
) {
  const message = {
    senderAddress:
      "DoNotReply@de9aded2-df12-4d57-9a7a-ae7631145cd7.azurecomm.net",
    content: {
      subject: "Device Error Notification",
      plainText: `Device ${deviceId} has encountered an error with code ${errorCode}.`,
    },
    recipients: {
      to: [{ address: "wiktor.michalski@outlook.com" }],
    },
  };
  try {
    const poller = await emailClient.beginSend(message);
    await poller.pollUntilDone();
    console.log(`Email notification sent for device ${deviceId}`);
  } catch (err) {
    console.error(
      `Error sending email notification for device ${deviceId}:`,
      err
    );
  }
}
