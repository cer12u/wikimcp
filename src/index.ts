#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient, gql } from "graphql-request";

const LIST_PAGES_TOOL: Tool = {
  name: "wiki_list_pages",
  description: "Get a list of pages from Wiki.js with optional filters",
  inputSchema: {
    type: "object",
    properties: {
      orderBy: {
        type: "string",
        description: "Order pages by this field (ID, PATH, TITLE, CREATED, UPDATED)",
        enum: ["ID", "PATH", "TITLE", "CREATED", "UPDATED"],
        default: "TITLE"
      },
      limit: {
        type: "number",
        description: "Maximum number of pages to return (optional)",
        default: 10
      }
    }
  }
};

const GET_PAGE_TOOL: Tool = {
  name: "wiki_get_page",
  description: "Get a single page from Wiki.js by ID or path",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "number",
        description: "The ID of the page to retrieve"
      },
      path: {
        type: "string",
        description: "The path of the page to retrieve"
      }
    },
    oneOf: [
      { required: ["id"] },
      { required: ["path"] }
    ]
  }
};

const CREATE_PAGE_TOOL: Tool = {
  name: "wiki_create_page",
  description: "Create a new page in Wiki.js",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path where the page will be created"
      },
      title: {
        type: "string",
        description: "The title of the page"
      },
      content: {
        type: "string",
        description: "The content of the page"
      },
      editor: {
        type: "string",
        description: "The editor to use (markdown, html, etc.)",
        default: "markdown"
      },
      isPublished: {
        type: "boolean",
        description: "Whether the page should be published",
        default: true
      }
    },
    required: ["path", "title", "content"]
  }
};

const UPDATE_PAGE_TOOL: Tool = {
  name: "wiki_update_page",
  description: "Update an existing page in Wiki.js",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "number",
        description: "The ID of the page to update"
      },
      path: {
        type: "string",
        description: "The path of the page to update (if ID is not provided)"
      },
      title: {
        type: "string",
        description: "The new title for the page (optional)"
      },
      content: {
        type: "string",
        description: "The new content for the page (optional)"
      },
      editor: {
        type: "string",
        description: "The editor to use (markdown, html, etc.)",
        default: "markdown"
      },
      isPublished: {
        type: "boolean",
        description: "Whether the page should be published",
        default: true
      }
    },
    oneOf: [
      { required: ["id"] },
      { required: ["path"] }
    ]
  }
};

const server = new Server(
  {
    name: "wikimcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const WIKI_API_URL = process.env.WIKI_API_URL || '';
const WIKI_API_TOKEN = process.env.WIKI_API_TOKEN || '';
if (!WIKI_API_URL) {
  console.error("Error: WIKI_API_URL environment variable is required");
  process.exit(1);
}
if (!WIKI_API_TOKEN) {
  console.error("Error: WIKI_API_TOKEN environment variable is required");
  process.exit(1);
}

const graphqlClient = new GraphQLClient(`${WIKI_API_URL}/graphql`, {
  headers: {
    Authorization: `Bearer ${WIKI_API_TOKEN}`,
  },
});

const LIST_PAGES_QUERY = gql`
  query ListPages($orderBy: PageOrderBy!, $limit: Int) {
    pages {
      list(orderBy: $orderBy, limit: $limit) {
        id
        path
        title
        createdAt
        updatedAt
      }
    }
  }
`;

const GET_PAGE_BY_ID_QUERY = gql`
  query GetPageById($id: Int!) {
    pages {
      single(id: $id) {
        id
        path
        title
        description
        content
        createdAt
        updatedAt
        editor
        isPublished
      }
    }
  }
`;

const GET_PAGE_BY_PATH_QUERY = gql`
  query GetPageByPath($path: String!) {
    pages {
      singleByPath(path: $path) {
        id
        path
        title
        description
        content
        createdAt
        updatedAt
        editor
        isPublished
      }
    }
  }
`;

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

const CREATE_PAGE_MUTATION = gql`
  mutation CreatePage($content: String!, $description: String, $editor: String!, $isPublished: Boolean!, $path: String!, $title: String!) {
    pages {
      create(content: $content, description: $description, editor: $editor, isPublished: $isPublished, path: $path, title: $title) {
        responseResult {
          succeeded
          errorCode
          slug
          message
        }
        page {
          id
          path
          title
        }
      }
    }
  }
`;

const UPDATE_PAGE_MUTATION = gql`
  mutation UpdatePage($id: Int!, $content: String, $description: String, $editor: String, $isPublished: Boolean, $title: String) {
    pages {
      update(id: $id, content: $content, description: $description, editor: $editor, isPublished: $isPublished, title: $title) {
        responseResult {
          succeeded
          errorCode
          slug
          message
        }
        page {
          id
          path
          title
        }
      }
    }
  }
`;

function isListPagesArgs(args: unknown): args is { 
  orderBy?: string;
  limit?: number;
} {
  return (
    typeof args === "object" &&
    args !== null
  );
}

function isGetPageArgs(args: unknown): args is { 
  id?: number;
  path?: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    (("id" in args && typeof (args as { id: number }).id === "number") ||
     ("path" in args && typeof (args as { path: string }).path === "string"))
  );
}

function isCreatePageArgs(args: unknown): args is {
  path: string;
  title: string;
  content: string;
  editor?: string;
  isPublished?: boolean;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "path" in args &&
    typeof (args as { path: string }).path === "string" &&
    "title" in args &&
    typeof (args as { title: string }).title === "string" &&
    "content" in args &&
    typeof (args as { content: string }).content === "string"
  );
}

function isUpdatePageArgs(args: unknown): args is {
  id?: number;
  path?: string;
  title?: string;
  content?: string;
  editor?: string;
  isPublished?: boolean;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    (("id" in args && typeof (args as { id: number }).id === "number") ||
     ("path" in args && typeof (args as { path: string }).path === "string"))
  );
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LIST_PAGES_TOOL, GET_PAGE_TOOL, CREATE_PAGE_TOOL, UPDATE_PAGE_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    if (name === "wiki_list_pages") {
      if (!isListPagesArgs(args)) {
        throw new Error("Invalid arguments for wiki_list_pages");
      }
      
      const orderBy = args.orderBy || "TITLE";
      const limit = args.limit || 10;
      
      const data = await graphqlClient.request(LIST_PAGES_QUERY, {
        orderBy,
        limit
      });
      
      const typedData = data as { pages: { list: any[] } };
      const pages = typedData.pages.list;
      const pageList = pages.map((page: any) => 
        `- ${page.title} (ID: ${page.id}, Path: ${page.path})${page.updatedAt ? `\n  Last Updated: ${new Date(page.updatedAt).toLocaleString()}` : ''}`
      ).join('\n\n');
      
      return {
        content: [{ 
          type: "text", 
          text: pages.length > 0 ? pageList : "No pages found" 
        }],
        isError: false,
      };
    }

    if (name === "wiki_get_page") {
      if (!isGetPageArgs(args)) {
        throw new Error("Invalid arguments for wiki_get_page");
      }

      let page;
      try {
        if (args.id) {
          const data = await graphqlClient.request(GET_PAGE_BY_ID_QUERY, { id: args.id });
          const typedData = data as { pages: { single: any } };
          page = typedData.pages.single;
        } else if (args.path) {
          const normalizedPath = normalizePath(args.path);
          console.error(`Fetching page by path: ${normalizedPath}`);
          
          const data = await graphqlClient.request(GET_PAGE_BY_PATH_QUERY, { path: normalizedPath });
          console.error("Get page by path response:", JSON.stringify(data, null, 2));
          
          const typedData = data as { pages: { singleByPath: any } };
          page = typedData.pages.singleByPath;
        } else {
          throw new Error("Either id or path must be provided");
        }
      } catch (error) {
        console.error("Error fetching page:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error fetching page: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true,
        };
      }

      if (!page) {
        return {
          content: [{ 
            type: "text", 
            text: `Page not found for ${args.id ? `ID: ${args.id}` : `path: ${args.path}`}` 
          }],
          isError: true,
        };
      }

      return {
        content: [{ 
          type: "text", 
          text: `# ${page.title}\n\n${page.content}` 
        }],
        isError: false,
      };
    }

    if (name === "wiki_create_page") {
      if (!isCreatePageArgs(args)) {
        throw new Error("Invalid arguments for wiki_create_page");
      }

      try {
        const normalizedPath = normalizePath(args.path);
        console.error(`Creating page with path: ${normalizedPath}`);
        
        const data = await graphqlClient.request(CREATE_PAGE_MUTATION, {
          path: normalizedPath,
          title: args.title,
          content: args.content,
          editor: args.editor || "markdown",
          isPublished: args.isPublished !== undefined ? args.isPublished : true,
          description: "" // Optional but included in the mutation
        });

        console.error("Create page response:", JSON.stringify(data, null, 2));
        
        const typedData = data as any;
        if (typedData && typedData.pages && typedData.pages.create) {
          const result = typedData.pages.create;
          
          if (result.responseResult && !result.responseResult.succeeded) {
            return {
              content: [{ 
                type: "text", 
                text: `Failed to create page: ${result.responseResult.message || 'Unknown error'}` 
              }],
              isError: true,
            };
          }
          
          if (result.page) {
            return {
              content: [{ 
                type: "text", 
                text: `Page created successfully:\nTitle: ${result.page.title}\nID: ${result.page.id}\nPath: ${result.page.path}` 
              }],
              isError: false,
            };
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Page may have been created, but the response format was unexpected: ${JSON.stringify(data)}` 
          }],
          isError: false,
        };
      } catch (error) {
        console.error("Create page error details:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error creating page: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true,
        };
      }
    }

    if (name === "wiki_update_page") {
      if (!isUpdatePageArgs(args)) {
        throw new Error("Invalid arguments for wiki_update_page");
      }

      try {
        let pageId = args.id;
        if (!pageId && args.path) {
          const normalizedPath = normalizePath(args.path);
          console.error(`Fetching page by path for update: ${normalizedPath}`);
          
          const data = await graphqlClient.request(GET_PAGE_BY_PATH_QUERY, { path: normalizedPath });
          console.error("Get page by path for update response:", JSON.stringify(data, null, 2));
          
          const typedData = data as any;
          if (typedData && typedData.pages && typedData.pages.singleByPath) {
            const page = typedData.pages.singleByPath;
            pageId = page.id;
          } else {
            return {
              content: [{ 
                type: "text", 
                text: `Page not found for path: ${normalizedPath}` 
              }],
              isError: true,
            };
          }
        }

        if (!pageId) {
          throw new Error("Could not determine page ID");
        }

        console.error(`Updating page with ID: ${pageId}`);
        const data = await graphqlClient.request(UPDATE_PAGE_MUTATION, {
          id: pageId,
          title: args.title,
          content: args.content,
          editor: args.editor,
          isPublished: args.isPublished,
          description: undefined // Optional
        });

        console.error("Update page response:", JSON.stringify(data, null, 2));
        
        const typedData = data as any;
        if (typedData && typedData.pages && typedData.pages.update) {
          const result = typedData.pages.update;
          
          if (result.responseResult && !result.responseResult.succeeded) {
            return {
              content: [{ 
                type: "text", 
                text: `Failed to update page: ${result.responseResult.message || 'Unknown error'}` 
              }],
              isError: true,
            };
          }
          
          if (result.page) {
            return {
              content: [{ 
                type: "text", 
                text: `Page updated successfully:\nTitle: ${result.page.title}\nID: ${result.page.id}\nPath: ${result.page.path}` 
              }],
              isError: false,
            };
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Page was updated successfully, but the response format was unexpected: ${JSON.stringify(data)}` 
          }],
          isError: false,
        };
      } catch (error) {
        console.error("Update page error details:", error);
        return {
          content: [{ 
            type: "text", 
            text: `Error updating page: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true,
        };
      }
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Wiki.js MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
