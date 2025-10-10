import OpenAI from "openai";
import {CustomTool} from "./CustomTool.js";
import MCPClient from "../mcp.js";

class CategoryNormalizerTool implements CustomTool {
	public tool: OpenAI.Responses.FunctionTool = {
		parameters: {},
		strict: false,
		name: "normalize_categories",
		type: "function",
		description: `
			Анализирует названия категорий и обобщает их, чтобы не было смысловых дублей.
			Необходимо вызывать перед созданием отчетов.
		`.trim()
	};

	async handle(input: any, ctx: any): Promise<object> {
		const mcpClient = MCPClient.makeChildProcess(`
				Ты агент "CategoryNormalizer". Твоя задача — анализировать существующие категории расходов и объединять их в обобщенные, чтобы не было смысловых дублей. 
				Например, категории "ужин", "обед", "завтрак" → "пропитание"; "такси", "бензин", "метро" → "транспорт".
				Правила работы:
				1. Всегда используй существующие категории, если они соответствуют смыслу.
				2. Если нужно создать новую обобщенную категорию, используй categories_post.
				3. После создания или переименования категории, переподключи все расходы через expenses_patch.
				4. Если категория полностью объединена в другую, удали старую через categories_delete.
				5. Возвращай JSON с mapping старых категорий в новые: { "oldCategoryId": "newCategoryName" }.
				6. Не описывай действия текстом — сразу вызывайте тулзы с нужными параметрами.
			`,
			[
				'categories_delete',
				'categories_get',
				'categories_patch',
				'categories_post',
				'expenses_patch',
				'expenses_get',
				'wallets_get',
			]);
		const response = await mcpClient.agent.call([
			{
				role: 'user',
				content: 'Получи список категорий и нормализуй их'
			}
		]);
		const result = await mcpClient.processOutput(response.output);

		return { result }
	}
}

export default new CategoryNormalizerTool();
