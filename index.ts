import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {Command} from 'commander';
import {
  AskAutoInputSchema,
  AskManualInputSchema,
  AskResponseSchema,
  ErrorResponseSchema,
  FlorentineRequestBodySchema,
  HeadersSchema,
  ListCollectionsResponseSchema,
  McpServerConfigSchema,
  TErrorResponse,
  TListCollectionsResponse,
  TLLMService,
  TLLMServiceSchema,
  ToolResponseSchema,
  TRequiredInput,
  TReturnTypes,
  type TAskInput,
  type TAskResponse
} from './types.js';
import {DebugLogger} from './logger.js';
import {ZodError} from 'zod';
import {handleZodError, unknownError} from './handleErrors.js';

const program = new Command();
program
  .option(
    '-m, --mode <mode>',
    'the mode to run the MCP server in ("static" or "dynamic")'
  )
  .option('-d, --debug <debug>', 'enable debug mode for logging')
  .option('-l, --logpath <logpath>', 'the debug log path');

// Remove the first two elements from process.argv because they are the node executable and the script path
program.parse(process.argv);
const options = program.opts();

let Logger: DebugLogger | Console | undefined = undefined;
if (options.debug) {
  Logger = options.logpath
    ? new DebugLogger({
        logPath: options.logpath
      })
    : console;
}

Logger?.log('Starting MCP server with options:', options);

if (!options.mode) {
  Logger?.error(
    'Missing mode argument. Use --mode <mode> to specify "static" or "dynamic".'
  );
  process.exit(1);
}
if (!['static', 'dynamic'].includes(options.mode)) {
  Logger?.error(
    'Wrong mode argument. Please specify "static" or "dynamic" for --mode.'
  );
  process.exit(1);
}

const serverMode = options.mode.toLowerCase();

const MODES = {
  STATIC: 'static', // For Desktop Apps (i.e. Claude Desktop or Dive AI) - All parameters need to be defined as env variables
  DYNAMIC: 'dynamic' // For own clients - Client sends parameters
};

const FLORENTINE_BASE_URL = 'https://nltm.florentine.ai';

const florentineToken = process.env.FLORENTINE_TOKEN;
if (!florentineToken) {
  Logger?.error('Missing "FLORENTINE_TOKEN" in environment variables');
  process.exit(1);
}

// Add florentine token to headers
const headers = HeadersSchema.parse({
  'Content-Type': 'application/json',
  'florentine-token': florentineToken
});

// Read parameters from environment variables
let llmService: TLLMService | undefined = process.env.LLM_SERVICE
  ? TLLMServiceSchema.parse(process.env.LLM_SERVICE)
  : undefined;
let llmKey: string | undefined = process.env.LLM_KEY;
let envSessionId: string | undefined = process.env.SESSION_ID;
let envReturnTypes: TReturnTypes[] = process.env.RETURN_TYPES
  ? JSON.parse(process.env.RETURN_TYPES)
  : [];
let envRequiredInputs: TRequiredInput[] = process.env.REQUIRED_INPUTS
  ? JSON.parse(process.env.REQUIRED_INPUTS)
  : [];

const askDescription: string = `Creates an aggregation, executes it and returns the resulting data from a MongoDB database for a 
  question asked by the user. It can handle complex questions that require multiple steps, 
  such as filtering, grouping, and sorting data. You should try to put as much information as possible 
  in the question. Only do query decomposition if you are sure that the question is too complex for a 
  single aggregation.`;

const ask = async (
  input: TAskInput
): Promise<TAskResponse | TErrorResponse> => {
  // Validiere Input mit Zod
  const validatedInput = AskManualInputSchema.parse(input);
  const {question, sessionId, returnTypes, requiredInputs} = validatedInput;

  try {
    // Create the request body
    // --> Merge environment variables with input parameters
    // --> Input parameters override environment variables
    const requestBody = FlorentineRequestBodySchema.parse({
      question,
      config: {
        ...(llmService ? {llmService} : {}),
        ...(llmKey ? {llmKey} : {}),
        ...(sessionId
          ? {sessionId}
          : envSessionId
          ? {sessionId: envSessionId}
          : {}),
        ...(envReturnTypes.length || returnTypes
          ? {returnTypes: Object.assign(envReturnTypes, returnTypes)}
          : {returnTypes: ['answer']}),
        ...(envRequiredInputs.length || requiredInputs
          ? {requiredInputs: Object.assign(envRequiredInputs, requiredInputs)}
          : {})
      }
    });
    Logger?.log('Request Body:', requestBody);

    const response: Response = await fetch(`${FLORENTINE_BASE_URL}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      Logger?.log('Error Response:', errorData);
      // Validate Error Response with Zod
      return ErrorResponseSchema.parse(errorData);
    }

    const rawResult = await response.json();
    Logger?.log('Response Result:', rawResult);
    // Validate Response with Zod
    return AskResponseSchema.parse(rawResult);
  } catch (err: unknown) {
    Logger?.error('Error calling florentine_ask tool:', err);
    if (err instanceof ZodError) return handleZodError(err);
  }
  return unknownError;
};

const listCollections = async (): Promise<
  TListCollectionsResponse | TErrorResponse
> => {
  try {
    const response: Response = await fetch(
      `${FLORENTINE_BASE_URL}/collections`,
      {
        headers
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      Logger?.log('Error Response:', errorData);
      // Validate Error Response with Zod
      return ErrorResponseSchema.parse(errorData);
    }

    const rawResult = await response.json();
    // Validate Response with Zod
    return ListCollectionsResponseSchema.parse(rawResult);
  } catch (err: unknown) {
    Logger?.error('Error calling florentine_list_collections tool:', err);
    if (err instanceof ZodError) return handleZodError(err);
  }
  return unknownError;
};

const serverConfig = McpServerConfigSchema.parse({
  name: 'florentine',
  version: '1.0.0'
});

const server = new McpServer(serverConfig);

server.tool(
  'florentine_list_collections',
  `Used internally to fetch metadata (name, summary, structure) of database collections **only when needed** to help answer a question via the "ask" tool. Should not be used alone.`,
  {},
  async () => {
    try {
      const response: TListCollectionsResponse | TErrorResponse =
        await listCollections();
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
      Logger?.log('List collections response parsing error:', err);
      return ToolResponseSchema.parse({
        content: [{type: 'text', text: JSON.stringify(unknownError)}],
        isError: true
      });
    }
  }
);

if (serverMode === MODES.STATIC) {
  server.tool(
    'florentine_ask',
    askDescription,
    AskAutoInputSchema.shape,
    async ({question}) => {
      try {
        const response: TAskResponse | TErrorResponse = await ask({question});
        return ToolResponseSchema.parse({
          content: [{type: 'text', text: JSON.stringify(response)}],
          isError: 'error' in response
        });
      } catch (err: unknown) {
        Logger?.log('Ask response parsing error:', err);
        return ToolResponseSchema.parse({
          content: [{type: 'text', text: JSON.stringify(unknownError)}],
          isError: true
        });
      }
    }
  );
}

if (serverMode === MODES.DYNAMIC) {
  server.tool(
    'florentine_ask',
    `${askDescription}
    IMPORTANT: Only provide the 'question' parameter. All other parameters (sessionId, requiredInputs, returnTypes) are automatically configured
    by the client and should NOT be provided.`,
    AskManualInputSchema.shape,
    async ({question, sessionId, requiredInputs, returnTypes}) => {
      try {
        const response: TAskResponse | TErrorResponse = await ask({
          question,
          sessionId,
          requiredInputs,
          returnTypes
        });
        return ToolResponseSchema.parse({
          content: [{type: 'text', text: JSON.stringify(response)}],
          isError: 'error' in response
        });
      } catch (err: unknown) {
        Logger?.log('err', err);
        return ToolResponseSchema.parse({
          content: [{type: 'text', text: JSON.stringify(unknownError)}],
          isError: true
        });
      }
    }
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
