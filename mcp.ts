import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

class MCPClient {
	private mcp: Client;
	private transport: StreamableHTTPClientTransport | null = null;
	private tools: any = [];

	constructor() {
		this.mcp = new Client({
			name: "mcp-client",
			version: "1.0.0"
		});
	}

	async connect(url: string) {
		try {
			this.transport = new StreamableHTTPClientTransport(new URL(url));
			await this.mcp.connect(this.transport);

			const toolsResult = await this.mcp.listTools();
			this.tools = toolsResult.tools.map((tool) => {
				return {
					name: tool.name,
					description: tool.description,
					input_schema: tool.inputSchema,
				};
			});
			console.log(
				"Connected to MCP server with tools:",
				this.tools.map((t: { name: any; }) => t.name)
			);
		} catch (e) {
			console.log("Failed to connect to MCP server: ", e);
			throw e;
		}
	}

	async processQuery(query: string, telegramId: string) {
		const messages = [
			{
				role: "user",
				content: query,
			},
		];

		const response = {
			content: [
				{
					type: 'text',
					text: 'hello',
					name: 'a',
					input: {}
				}
			]
		};

		const finalText = [];

		for (const content of response.content) {
			if (content.type === "text") {
				finalText.push(content.text);
			} else if (content.type === "tool_use") {
				const toolName = content.name;
				const toolArgs = content.input as { [x: string]: unknown } | undefined;

				const result = await this.mcp.callTool({
					name: toolName,
					arguments: toolArgs,
				});
				finalText.push(
					`[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
				);

				messages.push({
					role: "user",
					content: result.content as string,
				});

				const response = {
					content: [
						{
							type: 'text',
							text: 'hello',
							name: 'a',
							input: {}
						}
					]
				};

				finalText.push(
					response.content[0].type === "text" ? response.content[0].text : ""
				);
			}
		}

		return finalText.join("\n");
	}

	async cleanup() {
		await this.mcp.close();
	}
}

export default new MCPClient();
