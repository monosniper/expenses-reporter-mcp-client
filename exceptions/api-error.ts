class ApiError extends Error {
	public errors: [] | null = null;
	status: number;

	constructor(message: string, errors = null, status = 400) {
		super(message);
		this.status = status;
		this.errors = errors;
	}

	static BadRequest(message: string, errors = null) {
		return new ApiError(message, errors, 400);
	}

	static Unauthorized(message: string) {
		return new ApiError(message, null, 401);
	}

	static Forbidden(message: string) {
		return new ApiError(message, null, 403);
	}

	static NotFound(message: string) {
		return new ApiError(message, null, 404);
	}

	static Internal(message: string) {
		return new ApiError(message, null, 500);
	}
}

export default ApiError;