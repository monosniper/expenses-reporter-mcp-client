import MCPClient from "./mcp.js";
import bot from "./bot.js";
import {ogaToWav} from "./utils.js";
import path from 'path';
import Vosk from "./vosk.js";
import fs from "fs";

const handleMessage = async (ctx: any) => {
	const content = ctx.update.message.text;
	console.log(`[USER] ${content}`)
	if (content) {
		await MCPClient.call('messages_post', {
			role: 'user',
			content
		})

		const answer = await MCPClient.processQuery(content, 1)
		console.log(`[ASSISTANT] ${answer}`)

		await ctx.reply(answer)
		await MCPClient.call('messages_post', {
			role: 'assistant',
			content: answer
		})
	}
}

const handleAudio = async (ctx: any) => {
	const voice = ctx.update.message.voice

	if (voice) {
		const filePath = path.resolve(process.cwd(), `storage/${voice.file_unique_id}.wav`);

		if (!fs.existsSync(filePath)) {
			const fileUrl = await bot.telegram.getFileLink(voice.file_id);
			await ogaToWav(fileUrl.toString(), filePath)
		}

		ctx.update.message.text = await Vosk.voiceToText(filePath);
		await handleMessage(ctx)
	}
}

export {
	handleMessage,
	handleAudio,
}
