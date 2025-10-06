import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

if (typeof process.env.VOSK_HOST_RU !== 'string' || typeof process.env.VOSK_HOST_UZ !== 'string') {
	throw new Error('VOSK_HOST_RU or VOSK_HOST_UZ environment variable is missing');
}

class VoskClient {
	private createClient(host: string): { ws: WebSocket; ready: Promise<void> } {
		const ws = new WebSocket(host);
		const ready = new Promise<void>((resolve, reject) => {
			ws.on('open', () => resolve());
			ws.on('error', reject);
		});
		return { ws, ready };
	}

	private async transcribe(ws: WebSocket, ready: Promise<void>, filePath: string): Promise<string> {
		await ready;

		return new Promise((resolve, reject) => {
			let text = '';

			ws.on('message', (data: any) => {
				try {
					const msg = JSON.parse(data.toString());
					if (msg.text) {
						text = msg.text.trim();
					}
				} catch {
					// игнорируем не-json
				}
			});

			ws.on('close', () => resolve(text));

			const readStream = fs.createReadStream(path.resolve(filePath));
			readStream.on('data', chunk => ws.send(chunk));
			readStream.on('end', () => ws.send(JSON.stringify({ eof: 1 })));
			readStream.on('error', reject);
		});
	}

	async voiceToText(filePath: string): Promise<string> {
		const ru = this.createClient(process.env.VOSK_HOST_RU as string);
		const uz = this.createClient(process.env.VOSK_HOST_UZ as string);

		const [ruText, uzText] = await Promise.allSettled([
			this.transcribe(ru.ws, ru.ready, filePath),
			this.transcribe(uz.ws, uz.ready, filePath),
		]);

		ru.ws.close();
		uz.ws.close();

		const ruResult = ruText.status === 'fulfilled' ? ruText.value : '';
		const uzResult = uzText.status === 'fulfilled' ? uzText.value : '';

		if (!ruResult && !uzResult) {
			throw new Error('No transcription result from either host');
		}

		return ruResult.length >= uzResult.length ? ruResult : uzResult;
	}
}

const Vosk = new VoskClient();

export default Vosk;
