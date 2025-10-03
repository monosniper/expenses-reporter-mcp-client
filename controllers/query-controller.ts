import { NextFunction, Request, Response } from 'express';
import MCPClient from "../mcp.js";

class QueryController {
	async process(req: Request, res: Response, next: NextFunction) {
		try {
			// @ts-ignore
			return res.json(await MCPClient.processQuery(req.body.query, req.telegramId));
		} catch (e) {
			next(e);
		}
	}
}

export default new QueryController();
