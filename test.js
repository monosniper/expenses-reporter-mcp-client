import { spawn } from 'child_process';

function runPythonStream(scriptPath, args = []) {
	return new Promise((resolve, reject) => {
		const process = spawn('python3', [scriptPath, ...args]);
		
		let buffer = '';
		let lastJson = null;
		let depth = 0;
		let currentChunk = '';
		
		process.stdout.on('data', (data) => {
			const chunk = data.toString();
			
			for (const ch of chunk) {
				if (ch === '{') depth++;
				if (depth > 0) currentChunk += ch;
				if (ch === '}') {
					depth--;
					if (depth === 0) {
						try {
							const json = JSON.parse(currentChunk);
							lastJson = json;
						} catch {
							// некорректный кусок — игнор
						}
						currentChunk = '';
					}
				}
			}
		});
		
		process.stderr.on('data', (data) => {
			console.error('[Python stderr]', data.toString());
		});
		
		process.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Python exited with code ${code}`));
			} else {
				resolve(lastJson);
			}
		});
	});
}

// пример использования
(async () => {
	try {
		const result = await runPythonStream(
			'/var/www/my/vosk-server/websocket/test.py',
			['/var/www/my/expenses-reporter-mcp-client/storage/AgAD4AgAAtM7JVM.wav']
		);
		
		console.log('Финальный JSON:', result);
		console.log('Финальный текст:', result?.text);
	} catch (err) {
		console.error('Ошибка:', err);
	}
})();
