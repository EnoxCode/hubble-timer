// HubbleTimer Connector
import type { ServerSdk } from '../hubble-sdk';

export default function connector(sdk: ServerSdk) {
  const config = sdk.getConfig();

  sdk.schedule(60000, async () => {
    try {
      // TODO: Fetch data from your API
      const data = { message: 'Hello from HubbleTimer' };
      sdk.emit('hubbleTimer:data', data);
    } catch (err) {
      sdk.log.error(`Failed to fetch data: ${err}`);
    }
  });
}
