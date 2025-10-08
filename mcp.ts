import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import OpenAI from "openai";
import { yellow } from 'console-log-colors';
import process from "process";
import LLMClient from "./llm.js";
import {
	ResponseInput,
	ResponseInputItem,
	ResponseFunctionToolCall,
	ResponseOutputMessage,
	ResponseOutputText, ResponseOutputItem
} from "openai/resources/responses/responses";
import {sendFileFromUrl} from "./utils.js";
import config from "./config.js";

interface MCPCallResult {
	text: string;
}

class MCPClient {
	private mcp: Client;
	private transport: StreamableHTTPClientTransport | null = null;
	private tools: OpenAI.Responses.FunctionTool[] = [];
	private tgId: number = 0;
	private SYSTEM_MCP_CALLS: string[] = [
		'messages_get',
		'messages_post',
	]

	constructor() {
		this.mcp = new Client({
			name: "mcp-client",
			version: "1.0.0",
		});
	}

	setTgId(id: number) {
		this.tgId = id;
	}

	async connect(): Promise<void> {
		if (typeof process.env.MCP_URL !== "string") {
			throw new Error("MCP_URL environment variable is missing");
		}

		try {
			this.transport = new StreamableHTTPClientTransport(new URL(process.env.MCP_URL));
			await this.mcp.connect(this.transport);

			const toolsResult = await this.mcp.listTools();

			this.tools = toolsResult.tools.map((tool) => ({
				type: "function",
				name: tool.name || "",
				description: tool.description || "",
				parameters: {
					...tool.inputSchema,
					additionalProperties: false,
				},
				strict: false,
			}));

			console.log(
				"Connected to MCP server with tools:",
				this.tools.map((t) => t.name)
			);

			LLMClient.setTools(this.tools)
		} catch (e) {
			console.error("Failed to connect to MCP server:", e);
			throw e;
		}
	}

	async call(toolName: string, args: any): Promise<MCPCallResult> {
		if (!this.SYSTEM_MCP_CALLS.includes(toolName)) {
			console.log(`${yellow('[MCP Call]')} ${toolName}: ${JSON.stringify(args)}`);
		}

		const response = await this.mcp.callTool({
			name: toolName,
			arguments: args,
			headers: {
				[config.headers.telegram_id]: this.tgId,
				[config.headers.telegram_name]: "Ravil",
			},
		});

		if (!this.SYSTEM_MCP_CALLS.includes(toolName)) {
			// @ts-ignore
			console.log(`${yellow('[MCP Result]')} ${toolName}: ${JSON.stringify(response.content[0])}`);
		}

		// @ts-ignore
		return response.content[0] as MCPCallResult;
	}

	async getPreviousMessages(): Promise<ResponseInput> {
		const prevMessagesRaw = await this.call("messages_get", { limit: 9, tgId: 1 });

		let prevMessages = [];
		try {
			const parsed = JSON.parse(prevMessagesRaw.text);
			prevMessages = (parsed.messages ?? []).map((msg: any) => ({
				role: msg.role as "system" | "user" | "assistant",
				content: String(msg.content),
			}));
		} catch (err) {
			console.error("Failed to parse previous messages:", err);
		}

		return prevMessages.reverse();
	}

	async processQuery(query: string, tgId: number): Promise<string> {
		LLMClient.addPrevMessages(await this.getPreviousMessages())
		LLMClient.addMessage({
			role: 'user',
			content: query
		} as ResponseInputItem)

		let response: OpenAI.Responses.Response = await LLMClient.call();

		const answer = await this.processOutput(response.output);
		LLMClient.addAssistantMessage(answer)

		return answer;
	}

	async processToolCall(item: ResponseFunctionToolCall) {
		LLMClient.addMessage(item);

		const result = await this.call(item.name, JSON.parse(item.arguments));
		const jsonResult = JSON.parse(result.text)
		if (jsonResult.hasOwnProperty("type") && jsonResult.hasOwnProperty("url")) {
			try	{
				await sendFileFromUrl(this.tgId, jsonResult.url);
				result.text = 'Файл успешно отправлен пользователю'
			} catch {
				result.text = 'Не удалось скачать файл'
			}
		}

		LLMClient.addMessage({
			type: 'function_call_output',
			call_id: item.call_id,
			output: result.text,
		} as ResponseInputItem.FunctionCallOutput);
	}

	async processOutput(output: Array<ResponseOutputItem>): Promise<string> {
		for (const item of output) {
			if (item.type === 'function_call') {
				await this.processToolCall(item);
			} else {
				return ((item as ResponseOutputMessage).content[0] as ResponseOutputText).text
			}
		}

		const response = await LLMClient.call();
		return this.processOutput(response.output);
	}

	async cleanup(): Promise<void> {
		await this.mcp.close();
	}
}

export default new MCPClient();
