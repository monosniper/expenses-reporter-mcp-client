import MCPClient from "./mcp.js";
import bot from "./bot.js";
import {ogaToWav} from "./utils.js";
import path from 'path';
import Vosk from "./vosk.js";
import fs from "fs";
import { unlink } from 'fs/promises';
import {green, grey} from "console-log-colors";
import {consola} from "consola";

const loggerUser = consola.withTag('USER')
const loggerAssistant = consola.withTag('ASSISTANT')

const handleMessage = async (ctx: any) => {
	MCPClient.setTgId(ctx.update.message.chat.id);

	const content = ctx.update.message.text;
	loggerUser.info(grey(content))

	if (content) {
		const answer = await MCPClient.processQuery(content, 1)

		await ctx.reply(answer, {
			reply_mode: 'MarkdownV2'
		})

		await MCPClient.call('messages_post', {
			messages: [
				{ role: 'user', content },
				{ role: 'assistant', content: answer }
			]
		})

		loggerAssistant.info(green(answer))
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

		if (fs.existsSync(filePath)) {
			await unlink(filePath);
			await handleMessage(ctx)
		} else {
			await handleMessage('Не удалось распознать сообщение')
		}
	}
}

export {
	handleMessage,
	handleAudio,
}
