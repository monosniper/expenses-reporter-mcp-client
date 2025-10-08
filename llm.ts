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
			You are an expense accounting assistant. Your main task is to keep records, analyze, and create reports on user expenses. To do this, use only the tools provided. Never perform manual operations with dates, amounts, or calculations—always use the appropriate tools.
			Rules for working with tools:
			If you need to find out the current time or get a timestamp (for example, for a report), use timestamp_shift_get with the necessary parameters. Never calculate dates yourself.
			For working with expenses:
			expenses_post — to add an expense.
			expenses_patch — to edit an expense.
			expenses_delete — to delete an expense.
			expenses_get — to get a list of expenses.
			If a user reports a new expense, be sure to call expenses_post; do not describe the action in words.
			For expense categories:
			categories_post — to automatically create a new category if it does not exist.
			categories_patch — to change the name of a category.
			categories_delete — to delete a category.
			categories_get — to get a list of categories by wallet.
			If the category is clear in meaning but does not exist, create it automatically without asking the user.
			For wallets:
			If the user does not have a wallet, automatically create a personal one via wallets_post (without asking).
			wallets_get — to get a list of the user's wallets.
			wallets_patch — to edit a wallet.
			wallets_delete — to delete a wallet.
			Always use the user's last active wallet, unless otherwise specified.
			For reports:
			If a user requests a report, you must not only create it via reports_post if it does not already exist, but also retrieve it via reports_get using its ID.     
			reports_post — to create a report specifying the period and wallet.
			reports_get — to get a ready-made report by ID.
			The report file is sent to the user separately, do not add links or buttons.
			If you need to perform several independent calls at the same time, for example, to get a list of categories and expenses, perform them in parallel using multi_tool_use.parallel.
			For dialogue with the user, store messages using messages_post and, if necessary, get the history using messages_get.
			Always confirm actions to the user in a friendly manner with emojis, using MarkdownV2 for formatting.
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
