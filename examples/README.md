# Florentine MCP Examples

This directory contains usage examples for the Florentine.ai MCP (Model Context Protocol) server.

## Dynamic Ask Example

The `dynamicAsk` example demonstrates how to create a simple chat application that integrates with the Florentine MCP server and Claude AI. An article dealing with this example in detail can be found at [Medium](https://medium.com/@jens_53891/how-to-add-a-secure-multi-tenant-mongodb-query-option-to-your-ai-agent-b0d24d3b52ce).

### Architecture

- **Backend**: Express.js server that connects to the Florentine MCP server and Claude AI
- **Frontend**: Simple HTML/JavaScript chat interface
- **MCP Integration**: Uses Model Context Protocol to communicate with Florentine.ai's SaaS

### Features

- Real-time chat interface with Claude AI
- Dynamic parameter enhancement for Florentine.ai user-specific queries
- Automatic tool execution through MCP

### Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   export ANTHROPIC_API_KEY="YOUR_ANTHTROPIC_API_KEY"
   export FLORENTINE_TOKEN="YOUR_FLORENTINE_TOKEN"
   ```

3. **Start both backend and frontend**:

   ```bash
   npm run dynamicAsk
   ```

4. **Open your browser** and navigate to:
   - `http://localhost:8080` (frontend)
   - Backend API runs on `http://localhost:3000`

### How It Works

1. **User Input**: User types a message in the web interface
2. **Claude Integration**: Message is sent to Claude AI with available MCP tools
3. **Tool Execution**: If Claude requests tools, they are executed via the Florentine MCP server
4. **Dynamic Enhancement**: The `florentine_ask` tool gets automatically enhanced with user-specific data
5. **Response**: Final answer is returned to the user interface

### File Structure

```
dynamicAsk/
├── index.ts          # Express server with MCP and Claude integration
├── index.html        # Frontend chat interface
└── userService.ts    # Mock implementation of user data fetching service
```

- `POST /api/chat` - Send a message to the chat system
  - Body: `{ message: string, sessionId?: string }`
  - Response: `{ response: string }`
