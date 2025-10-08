import { spawn } from 'child_process';
import process from 'process';
import {magenta} from "console-log-colors";

if (typeof process.env.VOSK_HOST_RU !== 'string' || typeof process.env.VOSK_HOST_UZ !== 'string') {
	throw new Error('VOSK_HOST_RU or VOSK_HOST_UZ environment variable is missing');
}
import {consola, ConsolaInstance} from "consola";

class VoskClient {
	private logger: ConsolaInstance;

	constructor() {
		this.logger = consola.withTag('VOSK')
	}

	private async runPython(filePath: string, voskHost: string): Promise<{ text: string; conf: number }> {
		return new Promise((resolve, reject) => {
			const child = spawn('python3', ['./vosk.py', filePath, voskHost]);
			let buffer = '';
			let currentJson = '';
			let braceCount = 0;
			let lastText = '';
			let lastConf = 0;
			let stderrBuffer = '';

			child.stdout.on('data', (chunk) => {
				buffer += chunk.toString();

				for (const char of buffer) {
					if (char === '{') braceCount++;
					if (braceCount > 0) currentJson += char;
					if (char === '}') braceCount--;

					if (braceCount === 0 && currentJson.trim()) {
						try {
							const json = JSON.parse(currentJson);

							if (json.text) {
								lastText = json.text;
								if (typeof json.conf === 'number') lastConf = json.conf;
							}
						} catch (e) {
							this.logger.warn(`[PARSE ERROR] ${e}`)
							this.logger.warn(`[BROKEN JSON] ${currentJson}`)
						}
						currentJson = '';
					}
				}

				// очищаем только если JSON полностью закрыт
				if (braceCount === 0) buffer = '';
			});

			child.stderr.on('data', (data) => {
				stderrBuffer += data.toString();
				this.logger.error(`[PYTHON ERROR] ${data.toString().trim()}`)
			});

			child.on('close', (code) => {
				if (code !== 0) {
					return reject(new Error(`Python exited with code ${code}: ${stderrBuffer}`));
				}
				if (!lastText) {
					return reject(new Error(`No transcription result. Stderr:\n${stderrBuffer}`));
				}
				resolve({ text: lastText, conf: lastConf });
			});

			child.on('error', (err) => reject(err));

			// safety timeout
			setTimeout(() => {
				child.kill();
				reject(new Error('Python process timeout'));
			}, 60_000);
		});
	}

	async voiceToText(filePath: string): Promise<string> {
		this.logger.start(`Starting transcription for file: ${filePath}`)

		try {
			const ru = await this.runPython(filePath, process.env.VOSK_HOST_RU as string);
			const uz = await this.runPython(filePath, process.env.VOSK_HOST_UZ as string);

			this.logger.info(`${magenta('[RU]')} ${ru.text} (conf: ${ru.conf})`)
			this.logger.info(`${magenta('[UZ]')} ${uz.text} (conf: ${ru.conf})`)

			if (!ru.text && !uz.text) {
				throw new Error('No transcription result from either host');
			}

			// выбираем по средней уверенности
			return ru.conf >= uz.conf ? ru.text : uz.text;
		} catch (err) {
			this.logger.error(`Transcription error: ${err}`)
			throw err;
		}
	}
}

const Vosk = new VoskClient();
export default Vosk;
