import OpenAI from "openai";

export interface CustomTool {
	tool: OpenAI.Responses.FunctionTool;
	handle(input: any, ctx: any): Promise<object>;
}
