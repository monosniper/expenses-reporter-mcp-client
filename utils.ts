import { spawn } from 'child_process';
import fetch from 'node-fetch';
import ffmpegPath from 'ffmpeg-static';

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

		// stream.Writable у node-fetch v3 — ReadableStream, поэтому нужно адаптировать
		const readable = response.body as unknown as NodeJS.ReadableStream;
		readable.pipe(ffmpeg.stdin);

		ffmpeg.on('error', reject);
		ffmpeg.stderr.on('data', () => {}); // подавляем ffmpeg вывод
		ffmpeg.on('close', code => {
			if (code === 0) resolve(outputPath);
			else reject(new Error(`ffmpeg exited with code ${code}`));
		});
	});
}
