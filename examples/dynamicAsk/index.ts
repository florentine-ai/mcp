import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import dotenv from 'dotenv';
import { fetchUserData } from './userService';

dotenv.config();

const app = express();

// CORS configuration for localhost and 127.0.0.1
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:8080', 'http://127.0.0.1:8080'];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin))
    res.header('Access-Control-Allow-Origin', origin);

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  req.method === 'OPTIONS' ? res.sendStatus(200) : next();
});
app.use(express.json());

// Create the MCP client instance
const mcpClient = new Client({
  name: 'florentine',
  version: '0.2.1'
});

// Define MCP setup configuration
const mcpSetupConfig = new StdioClientTransport({
  command: 'npx',
  args: ['@florentine-ai/mcp', '--mode', 'dynamic'],
  env: {
    FLORENTINE_TOKEN: process.env.FLORENTINE_TOKEN || ''
  }
});

// Connect the MCP client
await mcpClient.connect(mcpSetupConfig);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Save original callTool function to variable
const originalCallTool = mcpClient.callTool.bind(mcpClient);

// Fetch and add florentine_ask parameters dynamically
const enhanceToolParameters = async ({
  question,
  sessionId
}: {
  question: string;
  sessionId: string;
}) => {
  return {
    question,
    // Fetch individual user data based on sessionId
    ...(await fetchUserData({ sessionId }))
  };
};

// Override callTool to enhance florentine_ask parameters
mcpClient.callTool = async (params, resultSchema, options) => {
  if (params.name === 'florentine_ask')
    params.arguments = await enhanceToolParameters(
      params.arguments as { question: string; sessionId: string }
    );

  console.dir(params.arguments, { depth: null });
  return await originalCallTool(params, resultSchema, options);
};

// Get all mcpClient tools
const toolsList = await mcpClient.listTools();

// Format tools for Claude
const claudeTools = toolsList.tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema
}));

const askAnthropic = async ({
  message,
  tool_use_id,
  previousResponse,
  toolResult
}: {
  message: string;
  tool_use_id?: string;
  previousResponse?: string;
  toolResult?: unknown;
}) => {
  let messages: Anthropic.Messages.MessageParam[] = [
    {
      role: 'user',
      content: message
    }
  ];
  if (previousResponse)
    messages.push({
      role: 'assistant',
      content: previousResponse
    });
  if (tool_use_id && toolResult)
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id,
          content: JSON.stringify(toolResult)
        }
      ]
    });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: claudeTools,
    messages
  });
  return response;
};

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  // Send message to Claude with tools
  let response = await askAnthropic({
    message
  });

  // Re-request Claude until no more tool_use is requested
  while (response.stop_reason === 'tool_use') {
    const toolUse = response.content.find((block) => block.type === 'tool_use');

    if (!toolUse) break;

    // Execute the requested tool using MCP
    const toolResult = await mcpClient.callTool({
      name: toolUse.name,
      arguments: {
        ...(toolUse.name === 'florentine_ask' ? { sessionId } : {}),
        ...(toolUse.input as { [x: string]: unknown } | undefined)
      }
    });

    // Send tool result back to Claude
    response = await askAnthropic({
      message,
      tool_use_id: toolUse.id,
      toolResult: toolResult.content
    });
  }

  // Return the final answer to the user
  const textResponse = response.content.find((block) => block.type === 'text');
  res.json({ response: textResponse?.text || 'No answer' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
