import "dotenv/config";
import MCPClient from "./mcp.js";
import {message} from "telegraf/filters";
import bot from "./bot.js";
import {handleAudio, handleMessage} from "./handlers.js";
import {consola} from "consola";
import RequestTelegramUsersTool from "./tools/RequestTelegramUsersTool.js";

(async () => {
	try {
		bot.on(message('voice'), handleAudio)
		bot.on(message('text'), handleMessage)
		bot.on('users_shared', (ctx) => {
			const promiseResolver = RequestTelegramUsersTool.getPromise(ctx.from.id);

			if (promiseResolver) {
				promiseResolver(ctx.message.users_shared.user_ids);
				RequestTelegramUsersTool.removePromise(ctx.from.id);
			}
		});

		await bot.launch({
			// @ts-ignore
			webhook: {
				domain: process.env.WEBHOOK_DOMAIN,
				port: process.env.PORT,
			},
		})

		process.once('SIGINT', () => bot.stop('SIGINT'))
		process.once('SIGTERM', () => bot.stop('SIGTERM'))
	} catch (err) {
		consola.error(err);
	} finally {
		await MCPClient.cleanup();
	}
})();
