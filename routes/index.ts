import express, {NextFunction, Request, Response} from "express";
import QueryController from "../controllers/query-controller.js";
import Joi from "joi";
import ApiError from "../exceptions/api-error.js";

const validate = (schema: Joi.ObjectSchema<any>, property = 'body') => {
	return (req: Request, res: Response, next: NextFunction) => {
		// @ts-ignore
		const data = req[property];

		const { error, value } = schema.validate(data, {
			abortEarly: false, // Показывать все ошибки, а не только первую
			allowUnknown: false, // Не разрешать неизвестные поля
			stripUnknown: true // Удалять неизвестные поля
		});

		if (error) {
			const errorMessages = error.details.map((detail: { message: any; }) => detail.message);
			// @ts-ignore
			return next(ApiError.BadRequest('Ошибки валидации', errorMessages));
		}

		// Заменяем исходные данные валидированными (с примененными трансформациями)
		// @ts-ignore
		req[property] = value;
		next();
	};
};

const router = express.Router();

router.post('/query', validate(Joi.object({
	query: Joi.string().required(),
}), 'body'), QueryController.process);

export default router;
