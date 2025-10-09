import OpenAI from "openai";

export interface CustomTool {
	tool: OpenAI.Responses.FunctionTool;
	handle(ctx: any): Promise<object>;
}
