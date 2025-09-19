#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command } from 'commander';
import {
  ArgsConfigSchema,
  EnvConfigSchema,
  TArgsConfig,
  TEnvConfig,
  TFlorentineConfig
} from './lib/types.js';
import { ZodError } from 'zod';
import { handleZodError } from './lib/handleErrors.js';
import { FlorentineServer } from './lib/FlorentineServer.js';
import { DebugLogger } from './lib/DebugLogger.js';

let logger: DebugLogger | Console | undefined;

try {
  const program = new Command();
  program
    .option(
      '-m, --mode <mode>',
      'the mode to run the MCP server in ("static" or "dynamic")'
    )
    .option('-d, --debug <debug>', 'enable debug mode for logging')
    .option('-l, --logpath <logpath>', 'the debug log path');

  program.parse(process.argv);

  const argsConfig: TArgsConfig = ArgsConfigSchema.parse(program.opts());

  logger =
    argsConfig.debug === 'true'
      ? argsConfig.logpath
        ? new DebugLogger({ logPath: argsConfig.logpath })
        : console
      : undefined;

  const envConfig: TEnvConfig = EnvConfigSchema.parse({
    florentineToken: process.env.FLORENTINE_TOKEN,
    llmService: process.env.LLM_SERVICE,
    llmKey: process.env.LLM_KEY,
    sessionId: process.env.SESSION_ID,
    requiredInputs: process.env.REQUIRED_INPUTS
      ? JSON.parse(process.env.REQUIRED_INPUTS)
      : undefined,
    returnTypes: process.env.RETURN_TYPES
      ? JSON.parse(process.env.RETURN_TYPES)
      : ['result']
  });

  const florentineConfig: TFlorentineConfig = { ...argsConfig, ...envConfig };

  const florentineServer = new FlorentineServer({
    florentineConfig,
    logger
  });

  florentineServer.initialize();
  logger?.info('Starting Florentine MCP server with options:', argsConfig);

  const transport = new StdioServerTransport();
  await florentineServer.getServer().connect(transport);
  logger?.info('Florentine MCP server connected and ready');
} catch (err) {
  logger
    ? logger.error(
        'Fatal error starting Florentine MCP server:',
        err instanceof ZodError ? handleZodError(err) : err
      )
    : console.error(
        'Fatal error starting Florentine MCP server:',
        err instanceof ZodError ? handleZodError(err) : err
      );
  process.exit(1);
}
