import "dotenv/config";
import MCPClient from "./mcp.js";
import {message} from "telegraf/filters";
import bot from "./bot.js";
import {handleAudio, handleMessage} from "./handlers.js";
import {consola} from "consola";

(async () => {
	try {
		await MCPClient.connect();

		bot.on(message('voice'), handleAudio)
		bot.on(message('text'), handleMessage)

		await bot.launch()

		process.once('SIGINT', () => bot.stop('SIGINT'))
		process.once('SIGTERM', () => bot.stop('SIGTERM'))
	} catch (err) {
		consola.error(err);
	} finally {
		await MCPClient.cleanup();
	}
})();
