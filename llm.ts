import OpenAI from "openai";
import process from "process";
import {
	ResponseInput,
	ResponseInputItem,
} from "openai/resources/responses/responses";

class LLM {
	private openAi: OpenAI;
	private readonly instructions: string;
	private readonly model: string;
	private messages: ResponseInput = [];
	private tools: OpenAI.Responses.FunctionTool[] = [];
	private isPrevMessagesAdded: boolean = false;

	constructor() {
		if (typeof process.env.OPENAI_MODEL !== 'string') {
			throw new Error('OPENAI_MODEL environment variable is missing');
		}

		this.openAi = new OpenAI();
		this.model = process.env.OPENAI_MODEL;
		this.instructions = `
			Ты — помощник по расходам. Собираешь статистику и анализируешь, можешь делать отчеты.
			Если пользователь говорит о своем расходе, то его нужно внести. 
			Если не указано, за что именно расход — уточни.
			Если категория понятна, но её нет в кошельке, создай её без подтверждения.
			Если пользователь просит дать отчет, ты должен создать его (если еще не было), затем запросить его по id, 
			только не формируй в ответе ссылки на скачивание и кнопки, файл уже отправляется сам, тебе этого делать не нужно 
			Кошелек используй последний выбранный пользователем.
			Валюта всегда — сум.
			Будь дружелюбным, используй эмодзи. Форматируй ответ красиво с MarkdownV2 style (ответ будет в телеграме)
		`.trim();
	}

	async call(): Promise<OpenAI.Responses.Response> {
		return this.openAi.responses.create({
			model: this.model,
			instructions: this.instructions,
			input: this.messages,
			tools: this.tools,
		});
	}

	setTools(tools: OpenAI.Responses.FunctionTool[]): void {
		this.tools = tools
	}

	addMessage(message: ResponseInputItem): void {
		this.messages.push(message);
	}

	addPrevMessages(prevMessages: ResponseInput): void {
		if (!this.isPrevMessagesAdded) {
			this.messages.push(...prevMessages);
			this.isPrevMessagesAdded = true;
		}
	}

	addAssistantMessage(content: string): void {
		this.addMessage({
			role: 'assistant',
			content,
		});
	}
}

const LLMClient = new LLM();

export default LLMClient;
