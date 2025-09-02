# Florentine.ai MCP Server

The Florentine.ai Model Context Protocol (MCP) server lets you integrate **natural language querying for your MongoDB data** directly into your custom AI Agent or AI Desktop App.

Questions are forwarded by the AI Agent to the MCP Server, transformed into MongoDB aggregations and the aggregation results are returned to the agent for further processing.

Also has a couple of extra features under the hood, e.g.:

- Secure data separation
- Semantic vector search/RAG support with automated embedding creation
- Advanced lookup support
- Exclusion of keys

## Prerequisites

- Node.js >= v18.0.0
- A Florentine.ai account (create a [free account here](https://app.florentine.ai/signup))
- A connected database and at least one analyzed and activated collection in your Florentine.ai account
- A Florentine.ai API Key (you can find yours on your [account dashboard](https://app.florentine.ai/dashboard))

## Installation

A detailed documentation can be found [here in our docs](https://docs.florentine.ai/mcp/overview.html).

You can easily run the server using npx. See the following example for Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "florentine": {
      "command": "npx",
      "args": ["-y", "@florentine-ai/mcp", "--mode", "static"],
      "env": {
        "FLORENTINE_TOKEN": "<FLORENTINE_API_KEY>"
      }
    }
  }
}
```

## Available Tools

- **florentine_list_collections** --> Lists all currently active collections that can be queried. That includes descriptions, keys and type of values.
- **florentine_ask** --> Receives a question and returns an aggregation, aggregation result or answer (depending on the returnTypes setting).

### Arguments

| Variable    | Required | Allowed values                                                         | Description                                                                                                                                                                          |
| ----------- | -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--mode`    | Yes      | `static`, `dynamic`                                                    | `static` (for existing external MCP clients, e.g. Claude Desktop) or `dynamic` (for own custom MCP clients). [See detailed docs](https://docs.florentine.ai/mcp/integration-modes/). |
| `--debug`   | No       | `true`                                                                 | Enables logging to external file. If set requires `--logpath` to be set as well.                                                                                                     |
| `--logpath` | No       | Absolute log file path, e.g. `/Users/USERNAME/logs/florentine-mcp.log` | File path to the debug log. If set requires `--debug` to be set as well.                                                                                                             |

### Environment Variables

| Variable           | Required | Allowed values                                                                   | Description                                                                                                                                          |
| ------------------ | -------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FLORENTINE_TOKEN` | Yes      | Florentine.ai API Key                                                            | `Your Florentine.ai API key. Can be found on your [account dashboard](https://app.florentine.ai/dashboard).                                          |
| `LLM_SERVICE`      | No       | `openai`, `anthropic`, `google`, `deepseek`                                      | The LLM service to use for the requests. Only needed if you did not add service and key in your Florentine.ai account.                               |
| `LLM_KEY`          | No       | LLM API Key                                                                      | The API key of the LLM service to use for the requests. Only needed if you did not add service and key in your Florentine.ai account.                |
| `SESSION_ID`       | No       | Any string                                                                       | A session identifier that enables server side chat history. [See detailed docs](https://docs.florentine.ai/mcp/sessions.html).                       |
| `RETURN_TYPES`     | No       | Stringified JSON array with any combination of `aggregation`, `result`, `answer` | Defines the return values of the `florentine_ask` tool. Defaults to `result`. [See detailed docs](https://docs.florentine.ai/mcp/return-types.html). |
| `REQUIRED_INPUTS`  | No       | Stringified JSON array of all required inputs.                                   | Defines the required inputs values of the `florentine_ask` tool. [See detailed docs](https://docs.florentine.ai/api/required-inputs.html).           |
