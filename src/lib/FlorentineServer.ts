import { ZodError } from 'zod';
import {
  AskAutoInputSchema,
  AskManualInputSchema,
  AskResponseSchema,
  ErrorResponseSchema,
  FlorentineRequestBodySchema,
  ListCollectionsResponseSchema,
  McpServerConfigSchema,
  TAskInput,
  TAskResponse,
  TErrorResponse,
  TFlorentineConfig,
  TListCollectionsResponse,
  ToolResponseSchema
} from './types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { handleZodError, unknownError } from './handleErrors.js';
import { DebugLogger } from './DebugLogger.js';
import { mergeConfigs } from './helpers.js';

export class FlorentineServer {
  private static FLORENTINE_BASE_URL = 'https://nltm.florentine.ai';
  private static ASK_DESCRIPTION = `Creates an aggregation, executes it and returns the resulting data from a MongoDB database for a 
  question asked by the user. It can handle complex questions that require multiple steps, 
  such as filtering, grouping, and sorting data. You should try to put as much information as possible 
  in the question. Only do query decomposition if you are sure that the question is too complex for a 
  single aggregation.`;
  private florentineConfig: TFlorentineConfig;
  private logger: DebugLogger | Console | undefined = undefined;
  private server: McpServer;
  private headers: HeadersInit;
  private isInitialized: boolean = false;

  constructor({
    florentineConfig,
    logger
  }: {
    florentineConfig: TFlorentineConfig;
    logger?: DebugLogger | Console | undefined;
  }) {
    this.florentineConfig = florentineConfig;
    this.logger = logger;
    this.headers = {
      'Content-Type': 'application/json',
      'florentine-token': this.florentineConfig.florentineToken
    };
    const serverConfig = McpServerConfigSchema.parse({
      name: 'florentine',
      version: '0.1.5'
    });
    this.server = new McpServer(serverConfig);
  }

  private listCollections = async (): Promise<
    TListCollectionsResponse | TErrorResponse
  > => {
    try {
      const response: Response = await fetch(
        `${FlorentineServer.FLORENTINE_BASE_URL}/collections`,
        {
          headers: this.headers
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        this.logger?.error(
          'Error calling florentine_list_collections tool:',
          errorData
        );
        return ErrorResponseSchema.parse(errorData);
      }

      const rawResult = await response.json();
      this.logger?.info(
        'Response from florentine_list_collections tool:',
        rawResult
      );
      return ListCollectionsResponseSchema.parse(rawResult);
    } catch (err: unknown) {
      this.logger?.error(
        'Error calling florentine_list_collections tool:',
        err
      );
      if (err instanceof ZodError) return handleZodError(err);
    }
    return unknownError;
  };

  private ask = async (
    input: TAskInput
  ): Promise<TAskResponse | TErrorResponse> => {
    try {
      const inputConfig = AskManualInputSchema.parse(input);
      const { question } = inputConfig;

      // Create the request body
      // --> Merge environment variables with input parameters
      // --> Input parameters override environment variables
      const requestBody = FlorentineRequestBodySchema.parse({
        question,
        config: mergeConfigs({
          florentineConfig: this.florentineConfig,
          inputConfig
        })
      });
      this.logger?.info('Request body of florentine_ask tool:', requestBody);

      const response: Response = await fetch(
        `${FlorentineServer.FLORENTINE_BASE_URL}/ask`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        this.logger?.error('Error calling florentine_ask tool:', errorData);
        return ErrorResponseSchema.parse(errorData);
      }

      const rawResult = await response.json();
      this.logger?.info('Response from florentine_ask tool:', rawResult);
      return AskResponseSchema.parse(rawResult);
    } catch (err: unknown) {
      this.logger?.error('Error calling florentine_ask tool:', err);
      if (err instanceof ZodError) return handleZodError(err);
    }
    return unknownError;
  };

  private handleToolError = ({
    caller,
    err
  }: {
    caller: 'list_collections' | 'ask';
    err: unknown;
  }) => {
    this.logger?.error(`Error calling florentine_${caller} tool:`, err);
    return ToolResponseSchema.parse({
      content: [{ type: 'text', text: JSON.stringify(unknownError) }],
      isError: true
    });
  };

  private registerTools = (): void => {
    this.logger?.info('Registering Tools...');
    this.server.registerTool(
      'florentine_list_collections',
      {
        title: 'Florentine List Collections',
        description: `Used internally to fetch metadata (name, summary, structure) of database collections **only when needed** to help answer a question via the "ask" tool. Should not be used alone.`,
        inputSchema: {}
      },
      async () => {
        try {
          const response: TListCollectionsResponse | TErrorResponse =
            await this.listCollections();
          return ToolResponseSchema.parse({
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  'error' in response ? response : response.summaries
                )
              }
            ],
            isError: 'error' in response
          });
        } catch (err: unknown) {
          return this.handleToolError({
            caller: 'list_collections',
            err
          });
        }
      }
    );

    if (this.florentineConfig.mode.toLowerCase() === 'static') {
      this.server.registerTool(
        'florentine_ask',
        {
          title: 'Florentine Ask',
          description: FlorentineServer.ASK_DESCRIPTION,
          inputSchema: AskAutoInputSchema.shape
        },
        async ({ question }) => {
          try {
            const response: TAskResponse | TErrorResponse = await this.ask({
              question
            });
            return ToolResponseSchema.parse({
              content: [{ type: 'text', text: JSON.stringify(response) }],
              isError: 'error' in response
            });
          } catch (err: unknown) {
            return this.handleToolError({
              caller: 'ask',
              err
            });
          }
        }
      );
    }

    if (this.florentineConfig.mode.toLowerCase() === 'dynamic') {
      this.server.registerTool(
        'florentine_ask',
        {
          title: 'Florentine Ask',
          description: `${FlorentineServer.ASK_DESCRIPTION}
        IMPORTANT: Only provide the 'question' parameter. All other parameters (sessionId, requiredInputs, returnTypes) are automatically configured
        by the client and should NOT be provided.`,
          inputSchema: AskManualInputSchema.shape
        },
        async ({ question, sessionId, requiredInputs, returnTypes }) => {
          try {
            const response: TAskResponse | TErrorResponse = await this.ask({
              question,
              sessionId,
              requiredInputs,
              returnTypes
            });
            return ToolResponseSchema.parse({
              content: [{ type: 'text', text: JSON.stringify(response) }],
              isError: 'error' in response
            });
          } catch (err: unknown) {
            return this.handleToolError({
              caller: 'ask',
              err
            });
          }
        }
      );
    }
  };

  public initialize = (): void => {
    if (this.isInitialized) {
      this.logger?.info('Florentine MCP Server is already initialized.');
      return;
    }
    this.logger?.info('Starting Florentine MCP Server...');
    this.registerTools();
    this.isInitialized = true;
  };

  public getServer(): McpServer {
    if (!this.isInitialized)
      throw new Error('Florentine MCP Server must be initialized before use.');
    return this.server;
  }
}
