import { spawn } from 'child_process';
import fetch from 'node-fetch';
import ffmpegPath from 'ffmpeg-static';
import bot from "./bot.js";
import fs from "fs";
import path from "path";
import * as https from "node:https";
import * as http from "node:http";
import MCPClient from "./mcp.js";

export function formatZodError(error: any): string {
	const skipLiterals = ['image', 'audio', 'resource', 'resource_link'];
	const seen = new Set<string>();
	const cleaned: { path: string; message: string }[] = [];

	const collect = (err: any) => {
		if (err.code === 'invalid_literal' && skipLiterals.includes(err.expected)) return;

		const path = Array.isArray(err.path) ? err.path.join('.') : String(err.path || '');
		const message = `${path}: ${err.message}`;
		if (!seen.has(message)) {
			seen.add(message);
			cleaned.push({ path, message });
		}
	};

	for (const issue of error.errors ?? []) {
		if (issue.code === 'invalid_union' && Array.isArray(issue.unionErrors)) {
			for (const sub of issue.unionErrors) {
				for (const subIssue of sub.errors ?? []) collect(subIssue);
			}
		} else {
			collect(issue);
		}
	}

	const grouped = new Map<string, string>();
	for (const e of cleaned) {
		if (!grouped.has(e.path)) grouped.set(e.path, e.message);
	}

	return Array.from(grouped.values()).join('\n');
}


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

export function ensureAdditionalPropertiesFalse(schema: any, _seen?: WeakSet<object>): any {
	const seen = _seen ?? new WeakSet<object>();

	if (!schema || typeof schema !== "object") return schema;
	if (seen.has(schema)) return schema;
	seen.add(schema);

	// Клонируем объект (чтобы не мутировать исходник)
	const out: any = Array.isArray(schema) ? schema.map((s) => ensureAdditionalPropertiesFalse(s, seen)) : { ...schema };

	// Определим, что это "объектная" схема:
	const type = out.type;
	const isObjectType =
		type === "object" ||
		(Array.isArray(type) && type.includes("object")) ||
		(out.properties !== undefined) ||
		(out.patternProperties !== undefined);

	if (isObjectType) {
		if (out.additionalProperties === undefined) out.additionalProperties = false;
	}

	// Рекурсивно обработать properties
	if (out.properties && typeof out.properties === "object") {
		for (const k of Object.keys(out.properties)) {
			out.properties[k] = ensureAdditionalPropertiesFalse(out.properties[k], seen);
		}
	}

	// Обработать items (массивы)
	if (out.items) {
		if (Array.isArray(out.items)) {
			out.items = out.items.map((it: any) => ensureAdditionalPropertiesFalse(it, seen));
		} else {
			out.items = ensureAdditionalPropertiesFalse(out.items, seen);
		}
	}

	// Композиции
	for (const key of ["oneOf", "anyOf", "allOf"]) {
		if (Array.isArray(out[key])) {
			out[key] = out[key].map((it: any) => ensureAdditionalPropertiesFalse(it, seen));
		}
	}

	// Если/тогда/иначе, not
	if (out.not) out.not = ensureAdditionalPropertiesFalse(out.not, seen);
	if (out.if) out.if = ensureAdditionalPropertiesFalse(out.if, seen);
	if (out.then) out.then = ensureAdditionalPropertiesFalse(out.then, seen);
	if (out.else) out.else = ensureAdditionalPropertiesFalse(out.else, seen);

	// definitions / $defs
	if (out.definitions && typeof out.definitions === "object") {
		for (const k of Object.keys(out.definitions)) {
			out.definitions[k] = ensureAdditionalPropertiesFalse(out.definitions[k], seen);
		}
	}
	if (out.$defs && typeof out.$defs === "object") {
		for (const k of Object.keys(out.$defs)) {
			out.$defs[k] = ensureAdditionalPropertiesFalse(out.$defs[k], seen);
		}
	}

	// patternProperties
	if (out.patternProperties && typeof out.patternProperties === "object") {
		for (const k of Object.keys(out.patternProperties)) {
			out.patternProperties[k] = ensureAdditionalPropertiesFalse(out.patternProperties[k], seen);
		}
	}

	// additionalItems
	if (out.additionalItems && typeof out.additionalItems === "object") {
		out.additionalItems = ensureAdditionalPropertiesFalse(out.additionalItems, seen);
	}

	// dependencies / dependentSchemas
	if (out.dependencies && typeof out.dependencies === "object") {
		for (const k of Object.keys(out.dependencies)) {
			const dep = out.dependencies[k];
			if (dep && typeof dep === "object" && !Array.isArray(dep)) {
				out.dependencies[k] = ensureAdditionalPropertiesFalse(dep, seen);
			}
		}
	}
	if (out.dependentSchemas && typeof out.dependentSchemas === "object") {
		for (const k of Object.keys(out.dependentSchemas)) {
			out.dependentSchemas[k] = ensureAdditionalPropertiesFalse(out.dependentSchemas[k], seen);
		}
	}

	return out;
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
