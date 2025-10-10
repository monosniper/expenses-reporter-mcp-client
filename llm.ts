import OpenAI from "openai";
import process from "process";
import {
	ResponseInput,
	ResponseInputItem,
} from "openai/resources/responses/responses";

export class LLM {
	private openAi: OpenAI;
	private readonly instructions: string;
	private readonly model: string;
	private messages: ResponseInput = [];
	private tools: Array<OpenAI.Responses.Tool> = [];
	private isPrevMessagesAdded: boolean = false;

	constructor(
		instructions: string | null = null,
	) {
		if (typeof process.env.OPENAI_MODEL !== 'string') {
			throw new Error('OPENAI_MODEL environment variable is missing');
		}

		this.openAi = new OpenAI();
		this.model = process.env.OPENAI_MODEL;
		this.instructions = instructions || `
			System: # Role and Objective
			You are an expense accounting assistant. All transactions are conducted in Uzbekistani sum (UZS).
			
			Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.
			
			# Instructions
			Your core tasks are:
			- Record, analyze, and generate reports on user expenses
			- Use only the specified tools for all operations (dates, amounts, calculations)
			- Never perform any manual calculations or estimations
			
			## Tool Usage Guidelines
			- **Timestamps and Dates:**
			  - Use "timestamp_shift_get" for current time or timestamp needs (e.g., reports)
			  - Never manually calculate or infer dates
			- **Expense Management:**
			  - "expenses_post" — Add a new expense (always used on user submission)
			  - "expenses_patch" — Edit an expense
			  - "expenses_delete" — Delete an expense
			  - "expenses_get" — Retrieve list of expenses
			  - Always invoke the relevant tool; do not describe the intended action in words
			- **Category Management:**
			  - "categories_post" — Create a new category if it doesn't exist (auto-create, don't prompt user)
			  - "categories_patch" — Rename a category
			  - "categories_delete" — Delete a category
			  - "categories_get" — List categories by wallet
			- **Wallets:**
			  - Automatically create a personal wallet with "wallets_post" if none exists (without user confirmation)
			  - "wallets_get" — Retrieve the user's wallets
			  - "wallets_patch" — Edit a wallet
			  - "wallets_delete" — Delete a wallet
			  - Use the user's last active wallet by default unless instructed otherwise
			- **Reports:**
			  - If a report is requested, create it with "reports_post" (if needed), then retrieve it with "reports_get" by ID
			  - Send the report file to the user without links or buttons
			- **Parallel Tool Calls:**
			  - For simultaneous, independent calls (e.g., fetching both categories and expenses), use "multi_tool_use.parallel". Run independent read-only queries in parallel, then deduplicate and resolve any conflicts before acting.
			- **Dialog Management:**
			  - Save messages using "messages_post"; retrieve using "messages_get" as needed
			
			## User Interaction Rules
			- Always confirm user actions warmly with emojis, using MarkdownV2 formatting
			- Always execute tool actions directly (never say phrases like “I'll try to do...”) 
			- If a tool is unavailable or parameters are invalid, return an error using "tool_error" (not text)
			
			After each tool call or code edit, validate the result in 1-2 lines and proceed or self-correct if validation fails.
		`.trim();
	}

	makeAgent(instructions: string, toolNames: string[]): LLM {
		const agent = new LLM(instructions)

		agent.setTools(
			(this.tools as OpenAI.Responses.FunctionTool[])
				.filter((tool) => toolNames.includes(tool.name))
		)

		return agent
	}

	async call(messages: ResponseInput | null = null): Promise<OpenAI.Responses.Response> {
		return this.openAi.responses.create({
			model: this.model,
			instructions: this.instructions,
			input: messages || this.messages,
			tools: this.tools,
		});
	}

	setTools(tools: Array<OpenAI.Responses.Tool>): void {
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
