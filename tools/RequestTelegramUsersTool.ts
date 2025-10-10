import OpenAI from "openai";
import {CustomTool} from "./CustomTool.js";

class RequestTelegramUsersTool implements CustomTool {
	private promises: any = {}
	public tool: OpenAI.Responses.FunctionTool = {
		parameters: {},
		strict: false,
		name: "request_telegram_users",
		type: "function",
		description: `
			Позволяет пользователю выбрать пользователей из своих контактов.
			Необходимо вызывать для создания общего кошелька или добавления в него новых пользователей.
		`.trim()
	};

	public getPromise(key: number) {
		return this.promises[key]
	}

	public removePromise(key: number): void {
		delete this.promises[key]
	}

	async handle(input: any, ctx: any): Promise<object> {
		await ctx.reply('Выберите пользователей для добавления в общий кошелек', {
			reply_markup: {
				keyboard: [
					[
						{
							text: 'Выбрать пользователей',
							request_users: {
								request_id: 123,
								user_is_bot: false,
								max_quantity: 10,
							},
						},
					],
				],
				resize_keyboard: true,
				one_time_keyboard: true,
			},
		});

		return new Promise((resolve) => {
			this.promises[ctx.from.id] = resolve;
		})
	}
}

export default new RequestTelegramUsersTool();
