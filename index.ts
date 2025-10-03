import dotenv from "dotenv";
import MCPClient from "./mcp.js";
import {Telegraf} from "telegraf";
import {message} from "telegraf/filters";

dotenv.config();

(async () => {
	try {
		// @ts-ignore
		const bot = new Telegraf(process.env.BOT_TOKEN)
		await MCPClient.connect(process.env.MCP_URL || '');

		bot.on(message('text'), async (ctx) => {
			const answer = await MCPClient.processQuery(ctx.update.message.text, '')

			await ctx.reply(answer)
		})

		await bot.launch()

		process.once('SIGINT', () => bot.stop('SIGINT'))
		process.once('SIGTERM', () => bot.stop('SIGTERM'))
	} catch (err) {
		console.error('Ошибка:', err);
	} finally {
		await MCPClient.cleanup();
	}
})();
