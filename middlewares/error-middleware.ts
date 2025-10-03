import {NextFunction, Request, Response} from "express";
import ApiError from "../exceptions/api-error.js";

export default async function (error: { message: any; status: number; errors: any; }, req: Request, res: Response, next: NextFunction) {
	if (error instanceof ApiError) {
		const response = {
			errors: [],
			error: error.message,
			status: error.status
		};

		// Добавляем детали ошибок валидации, если они есть
		if (error.errors) {
			response.errors = error.errors;
		}

		return res.status(error.status).json(response);
	}

	console.log(error);

	// Обработка неожиданных ошибок
	return res.status(500).json({
		error: 'Внутренняя ошибка сервера',
		status: 500
	});
}
