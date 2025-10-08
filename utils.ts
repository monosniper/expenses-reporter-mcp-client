import { spawn } from 'child_process';
import fetch from 'node-fetch';
import ffmpegPath from 'ffmpeg-static';
import bot from "./bot.js";
import fs from "fs";
import path from "path";
import * as https from "node:https";
import * as http from "node:http";

export async function ogaToWav(url: string, outputPath: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch audio: ${response.statusText}`);
	}

	if (!response.body) {
		throw new Error('No response body');
	}

	return new Promise((resolve, reject) => {
		const ffmpeg = spawn(ffmpegPath as unknown as string, [
			'-i', 'pipe:0',
			'-ac', '1',
			'-ar', '16000',
			'-f', 'wav',
			outputPath
		]);

		const readable = response.body as unknown as NodeJS.ReadableStream;
		readable.pipe(ffmpeg.stdin);

		ffmpeg.on('error', reject);
		ffmpeg.stderr.on('data', () => {});
		ffmpeg.on('close', code => {
			if (code === 0) resolve(outputPath);
			else reject(new Error(`ffmpeg exited with code ${code}`));
		});
	});
}

export async function sendFileFromUrl(chatId: number, fileUrl: string): Promise<void> {
	const fileName = path.basename(new URL(fileUrl).pathname);
	const tempPath = path.join('/tmp', fileName);

	const client = fileUrl.startsWith('https') ? https : http;

	await new Promise((resolve, reject) => {
		const file = fs.createWriteStream(tempPath);
		client.get(fileUrl, response => {
			if (response.statusCode !== 200) {
				return reject(new Error(`Failed to download file: ${response.statusCode}`));
			}
			response.pipe(file);
			file.on('finish', () => file.close(resolve));
		}).on('error', err => {
			fs.unlink(tempPath, () => reject(err));
		});
	});

	await bot.telegram.sendDocument(chatId, { source: tempPath });

	fs.unlink(tempPath, () => {});
}
