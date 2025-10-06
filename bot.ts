import {Telegraf} from "telegraf";

if (typeof process.env.BOT_TOKEN !== 'string') {
	throw new Error("BOT_TOKEN environment variable is missing");
}

const bot = new Telegraf(process.env.BOT_TOKEN)

export default bot;
