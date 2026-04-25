#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const REPORTS_FILE = join(ROOT, "reports.json");

const server = new Server(
  {
    name: "dekweb-reporter",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

function getReports() {
  if (!existsSync(REPORTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(REPORTS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "reports://all",
        name: "All rendering issue reports",
        mimeType: "application/json",
        description: "A list of all issues reported by the user in the dekweb viewer.",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "reports://all") {
    return {
      contents: [
        {
          uri: "reports://all",
          mimeType: "application/json",
          text: JSON.stringify(getReports(), null, 2),
        },
      ],
    };
  }
  throw new Error("Resource not found");
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_reports",
        description: "Retrieve all rendering issue reports.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "clear_reports",
        description: "Clear all rendering issue reports.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_reports": {
      const reports = getReports();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(reports, null, 2),
          },
        ],
      };
    }
    case "clear_reports": {
      writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2));
      return {
        content: [
          {
            type: "text",
            text: "Reports cleared.",
          },
        ],
      };
    }
    default:
      throw new Error("Unknown tool");
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("dekweb MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
