import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {SSEClientTransport} from "@modelcontextprotocol/sdk/client/sse.js";
import OpenAI from "openai";
import { yellow, grey } from 'console-log-colors';
import process from "process";
import LLMClient from "./llm.js";
import {consola, ConsolaInstance} from "consola";
import {
	ResponseInput,
	ResponseInputItem,
	ResponseFunctionToolCall,
	ResponseOutputMessage,
	ResponseOutputText,
	ResponseOutputItem
} from "openai/resources/responses/responses";
import {ensureAdditionalPropertiesFalse, formatZodError, sendFileFromUrl} from "./utils.js";
import config from "./config.js";
import RequestTelegramUsersTool from "./tools/RequestTelegramUsersTool.js";
import {CustomTool} from "./tools/CustomTool.js";

interface MCPCallResult {
	text: string;
}

class MCPClient {
	private mcp: Client;
	private transport: SSEClientTransport | null = null;
	private tools: Array<OpenAI.Responses.Tool> = [];
	private ctx: any;
	private tgId: number = 0;
	private tgName: string = '';
	private WITHOUT_HEADERS: string[] = [
		'reports_delete',
	];
	private SYSTEM_MCP_CALLS: string[] = [
		'messages_get',
		'messages_post',
	]
	private NON_STRICT_TOOLS: string[] = [
		'timestamp_shift_get',
		'reports_delete',
	]
	private CUSTOM_TOOLS: CustomTool[] = [
		RequestTelegramUsersTool,
	]
	private logger: ConsolaInstance;

	constructor() {
		this.mcp = new Client({
			name: "mcp-client",
			version: "1.0.0",
		});
		this.logger = consola.withTag('MCP')
	}

	setCtx(ctx: any) {
		this.ctx = ctx;
	}

	setTgId(id: number) {
		this.tgId = id;
	}

	setTgName(name: string) {
		this.tgName = name;
	}

	async connect(): Promise<void> {
		if (typeof process.env.MCP_URL !== "string") {
			throw new Error("MCP_URL environment variable is missing");
		}

		try {
			this.transport = new SSEClientTransport(new URL(process.env.MCP_URL));
			await this.mcp.connect(this.transport);

			const toolsResult = await this.mcp.listTools();

			this.tools = toolsResult.tools.map((tool) => ({
				type: "function",
				name: tool.name || "",
				description: tool.description || "",
				parameters: ensureAdditionalPropertiesFalse({
					...tool.inputSchema,
					additionalProperties: false,
				}),
				strict: !this.NON_STRICT_TOOLS.includes(tool.name),
			}));

			this.CUSTOM_TOOLS.forEach((customTool) => {
				this.tools.push(customTool.tool)
			})

			this.logger.success('Connected to MCP server')
			this.logger.box({
				title: 'Tools',
				message: (this.tools as OpenAI.Responses.FunctionTool[])
					.map((t) => {
						let desc = (t.description || '')
							.replace(/\r?\n/g, ' ')
							.replace(/\*\*/g, '')
							.replace(/\s+/g, ' ')
							.trim();

						if (desc.length > 100) {
							desc = desc.slice(0, 60) + '…';
						}

						return `${yellow(t.name)} - ${grey(desc)}`;
					})
					.join('\n'),
				style: {
					padding: 1,
					borderColor: 'yellow',
				}
			})

			LLMClient.setTools(this.tools)
		} catch (e) {
			throw new Error(`Failed to connect to MCP server: ${e}`);
		}
	}

	async call(toolName: string, args: any): Promise<MCPCallResult> {
		try {
			const response = await this.mcp.callTool({
				name: toolName,
				arguments: {
					...args,
					...(this.WITHOUT_HEADERS.includes(toolName) ? {} : {
						[`header_${config.headers.telegram_id.toLowerCase().replaceAll('-', '_')}`]: this.tgId,
						[`header_${config.headers.telegram_name.toLowerCase().replaceAll('-', '_')}`]: this.tgName,
					}),
				},
			});

			// @ts-ignore
			const result = response.content[0] as MCPCallResult;

			if (!this.SYSTEM_MCP_CALLS.includes(toolName)) {
				this.logger.box({
					title: toolName,
					style: {
						padding: 1,
						borderColor: 'yellow',
					},
					message: [
						`ARGS:`,
						grey(JSON.stringify(args, null, 2)),
						``,
						`Result:`,
						grey(JSON.stringify(JSON.parse(result.text), null, 2))
					].join('\n')
				});
			}

			return result;
		} catch (error) {
			console.log(error)
			return {
				text: JSON.stringify({
					errors: formatZodError(error)
				}),
			}
		}
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
			this.logger.error(`Failed to parse previous messages: ${err}`)
		}

		return prevMessages.reverse();
	}

	async processQuery(query: string): Promise<string | any> {
		LLMClient.addPrevMessages(await this.getPreviousMessages());

		LLMClient.addMessage({
			role: 'user',
			content: query
		} as ResponseInputItem);

		const response = await LLMClient.call();

		const answer = await this.processOutput(response.output);

		if (typeof answer === 'object' && answer.async) {
			return { async: true, promise: answer.promise.then(async (rs: any) => {
				LLMClient.addAssistantMessage(rs);
				return rs;
			})};
		} else {
			LLMClient.addAssistantMessage(answer);
			return answer;
		}
	}

	async processToolCall(item: ResponseFunctionToolCall): Promise<any | void> {
		LLMClient.addMessage(item);

		let result = { text: '' };

		const customTool = this.CUSTOM_TOOLS.find((customTool) => customTool.tool.name === item.name);

		if (customTool) {
			const promise = customTool.handle(this.ctx)
				.then(rs => {
					const resultText = JSON.stringify(rs);

					LLMClient.addMessage({
						type: 'function_call_output',
						call_id: item.call_id,
						output: resultText,
					});
				})
				.catch(err => {
					const errorText = JSON.stringify({ error: err.message });

					LLMClient.addMessage({
						type: 'function_call_output',
						call_id: item.call_id,
						output: errorText,
					});
				});

			return { async: true, promise };
		} else {
			result = await this.call(item.name, JSON.parse(item.arguments));
			const jsonResult = JSON.parse(result.text)

			if (jsonResult.hasOwnProperty("type") && jsonResult.hasOwnProperty("url")) {
				try	{
					await sendFileFromUrl(this.tgId, jsonResult.url);
					await this.call('reports_delete', { id: JSON.parse(item.arguments).id })
					result.text = 'Файл успешно отправлен пользователю'
				} catch {
					result.text = `Не удалось скачать файл. Вот прямая ссылка - ${jsonResult.url}`
				}
			}
		}

		LLMClient.addMessage({
			type: 'function_call_output',
			call_id: item.call_id,
			output: result.text,
		} as ResponseInputItem.FunctionCallOutput);
	}

	async processOutput(output: Array<ResponseOutputItem>): Promise<any | string> {
		for (const item of output) {
			if (item.type === 'function_call') {
				const result = await this.processToolCall(item);

				if (typeof result === 'object' && result.async) {
					return { async: true, promise: result.promise.then(async () => {
						const response = await LLMClient.call();
						return this.processOutput(response.output);
					})};
				} else {
					const response = await LLMClient.call();
					return this.processOutput(response.output);
				}
			}

			if (item.type === 'message') {
				const text = ((item as ResponseOutputMessage).content[0] as ResponseOutputText).text;
				return Promise.resolve(text);
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
