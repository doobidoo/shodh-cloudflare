#!/usr/bin/env node

/**
 * SHODH Cloudflare MCP Bridge
 *
 * Connects MCP clients (Claude Desktop, etc.) to your SHODH API on Cloudflare.
 *
 * Environment variables:
 *   SHODH_CLOUDFLARE_URL - Your Worker URL (required)
 *   SHODH_CLOUDFLARE_API_KEY - Your API key (required)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.SHODH_CLOUDFLARE_URL;
const API_KEY = process.env.SHODH_CLOUDFLARE_API_KEY;

if (!API_URL) {
  console.error("Error: SHODH_CLOUDFLARE_URL environment variable is required");
  process.exit(1);
}

if (!API_KEY) {
  console.error("Error: SHODH_CLOUDFLARE_API_KEY environment variable is required");
  process.exit(1);
}

async function apiRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  return response.json();
}

const server = new Server(
  {
    name: "shodh-cloudflare",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "remember",
        description: "Store a memory for future recall. Use this to remember important information, decisions, user preferences, project context, or anything you want to recall later.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The content to remember (observation, decision, learning, etc.)",
            },
            type: {
              type: "string",
              enum: ["Observation", "Decision", "Learning", "Error", "Discovery", "Pattern", "Context", "Task", "CodeEdit", "FileAccess", "Search", "Command", "Conversation"],
              default: "Observation",
              description: "Type of memory",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags for categorization",
            },
            source_type: {
              type: "string",
              enum: ["user", "system", "api", "file", "web", "ai_generated", "inferred"],
              description: "Source type: where the information came from",
            },
            emotion: {
              type: "string",
              description: "Dominant emotion label (e.g., 'joy', 'frustration', 'surprise')",
            },
            emotional_valence: {
              type: "number",
              description: "Emotional valence: -1.0 (negative) to 1.0 (positive)",
            },
            emotional_arousal: {
              type: "number",
              description: "Arousal level: 0.0 (calm) to 1.0 (highly aroused)",
            },
            credibility: {
              type: "number",
              description: "Credibility score: 0.0 to 1.0",
            },
            episode_id: {
              type: "string",
              description: "Episode ID - groups memories into coherent episodes",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "recall",
        description: "Search memories using semantic similarity. Use this to find relevant past experiences, decisions, or context.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language search query",
            },
            limit: {
              type: "number",
              default: 5,
              description: "Maximum number of results (default: 5)",
            },
            mode: {
              type: "string",
              enum: ["semantic", "associative", "hybrid"],
              default: "hybrid",
              description: "Retrieval mode",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "proactive_context",
        description: "Surface relevant memories based on current context and optionally store the context as a memory. Call this with user messages to maintain conversation continuity.",
        inputSchema: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description: "The current conversation context or topic",
            },
            max_results: {
              type: "number",
              default: 5,
              description: "Maximum number of memories to surface",
            },
            auto_ingest: {
              type: "boolean",
              default: true,
              description: "Automatically store the context as a Conversation memory",
            },
          },
          required: ["context"],
        },
      },
      {
        name: "list_memories",
        description: "List all stored memories with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              default: 20,
              description: "Maximum number of results",
            },
            offset: {
              type: "number",
              default: 0,
              description: "Offset for pagination",
            },
            type: {
              type: "string",
              description: "Filter by memory type",
            },
          },
        },
      },
      {
        name: "forget",
        description: "Delete a specific memory by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the memory to delete",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "forget_by_tags",
        description: "Delete memories matching any of the provided tags",
        inputSchema: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags to match for deletion",
            },
          },
          required: ["tags"],
        },
      },
      {
        name: "memory_stats",
        description: "Get statistics about stored memories",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "context_summary",
        description: "Get a condensed summary of recent learnings, decisions, and context",
        inputSchema: {
          type: "object",
          properties: {
            max_items: {
              type: "number",
              default: 5,
              description: "Maximum items per category",
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "remember": {
        const result = await apiRequest("/api/remember", "POST", {
          content: args.content,
          type: args.type,
          tags: args.tags,
          source_type: args.source_type,
          emotion: args.emotion,
          emotional_valence: args.emotional_valence,
          emotional_arousal: args.emotional_arousal,
          credibility: args.credibility,
          episode_id: args.episode_id,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "recall": {
        const result = await apiRequest("/api/recall", "POST", {
          query: args.query,
          limit: args.limit || 5,
          mode: args.mode || "hybrid",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "proactive_context": {
        const result = await apiRequest("/api/context", "POST", {
          context: args.context,
          max_results: args.max_results || 5,
          auto_ingest: args.auto_ingest !== false,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_memories": {
        const params = new URLSearchParams();
        if (args.limit) params.set("limit", args.limit.toString());
        if (args.offset) params.set("offset", args.offset.toString());
        if (args.type) params.set("type", args.type);
        
        const result = await apiRequest(`/api/memories?${params.toString()}`);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "forget": {
        const result = await apiRequest(`/api/forget/${args.id}`, "DELETE");
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "forget_by_tags": {
        const result = await apiRequest("/api/forget/by-tags", "POST", {
          tags: args.tags,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "memory_stats": {
        const result = await apiRequest("/api/stats");
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "context_summary": {
        // Get recent memories of different types for a summary
        const [decisions, learnings, context] = await Promise.all([
          apiRequest(`/api/memories?type=Decision&limit=${args.max_items || 5}`),
          apiRequest(`/api/memories?type=Learning&limit=${args.max_items || 5}`),
          apiRequest(`/api/memories?type=Context&limit=${args.max_items || 5}`),
        ]);
        
        const summary = {
          recent_decisions: decisions.memories || [],
          recent_learnings: learnings.memories || [],
          recent_context: context.memories || [],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SHODH Cloudflare MCP bridge running");
}

main().catch(console.error);
