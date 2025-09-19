import { ZodError } from 'zod';
import { DebugLogger } from './lib/DebugLogger.js';
import { FlorentineServer } from './lib/FlorentineServer.js';
import { FlorentineConfigSchema, TFlorentineConfig } from './lib/types.js';
import { handleZodError } from './lib/handleErrors.js';

export const configSchema = FlorentineConfigSchema;

export default function createServer({
  config
}: {
  config: TFlorentineConfig;
}) {
  try {
    const florentineConfig: TFlorentineConfig =
      FlorentineConfigSchema.parse(config);
    let logger: DebugLogger | Console | undefined =
      florentineConfig.debug === 'true'
        ? florentineConfig.logpath
          ? new DebugLogger({ logPath: florentineConfig.logpath })
          : console
        : undefined;

    const florentineServer = new FlorentineServer({
      florentineConfig,
      logger
    });

    florentineServer.initialize();

    return florentineServer.getServer();
  } catch (err) {
    if (err instanceof ZodError) {
      const zodError = handleZodError(err);
      throw new Error(zodError.error.message);
    }
    throw err;
  }
}
