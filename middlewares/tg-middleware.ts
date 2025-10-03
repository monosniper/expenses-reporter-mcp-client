import {NextFunction, Request, Response} from "express";
import config from "../config.js";

export default async function (req: Request, res: Response, next: NextFunction) {
	const header = config.headers.telegram_id.toLowerCase()

	if (req.headers.hasOwnProperty(header)) {
		// @ts-ignore
		req.telegramId = req.headers[header]
	} else {
		return res.status(500).json({message: 'Не передан заголовок ' + header});
	}

	next();
}
