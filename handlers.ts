import MCPClient from "./mcp.js";
import bot from "./bot.js";
import {ogaToWav} from "./utils.js";
import path from 'path';

const handleMessage = async (ctx: any) => {
	const content = ctx.update.message.text;
	console.log(ctx)
	if (content) {
		await MCPClient.call('message_post', content)
		const answer = await MCPClient.processQuery(content, '')

		await ctx.reply(answer)
	}
}

const handleAudio = async (ctx: any) => {
	const voice = ctx.update.message.voice

	if (voice) {
		const fileUrl = await bot.telegram.getFileLink(voice.file_id);
		await ogaToWav(fileUrl.toString(), path.resolve(process.cwd(), `storage/${voice.file_unique_id}.wav`))

		console.log(ctx.update.message.from)
		console.log(ctx.update.message.chat)
		console.log(voice)
	}
}

export {
	handleMessage,
	handleAudio,
}
