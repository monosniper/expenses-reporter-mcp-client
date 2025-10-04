import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import ollama, {ChatResponse} from 'ollama'

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
		const messages: { role: string; content: string }[] = [
			{ role: "user", content: query },
		];

		const response: ChatResponse = await ollama.chat({
			model: process.env.LLM_MODEL || '',
			messages,
			think: false
		});

		const finalText: string[] = [];

		// основной текст от модели
		if (response.message.content) {
			finalText.push(response.message.content);
		}

		// проверяем, есть ли tool_calls
		if (response.message.tool_calls && response.message.tool_calls.length > 0) {
			for (const toolCall of response.message.tool_calls) {
				const toolName = toolCall.function.name;
				const toolArgs = toolCall.function.arguments;

				finalText.push(
					`[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
				);

				// вызываем MCP-инструмент
				const result = await this.mcp.callTool({
					name: toolName,
					arguments: toolArgs,
				});

				// кладем результат в messages для контекста
				messages.push({
					role: "user",
					content: result.content as string,
				});

				// добавляем в финальный вывод
				finalText.push(result.content as string);
			}
		}

		return finalText.join("\n");
	}

	async cleanup() {
		await this.mcp.close();
	}
}

export default new MCPClient();
