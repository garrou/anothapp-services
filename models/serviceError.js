export default class ServiceError extends Error {
    constructor(code, message) {
        super(message);
        this.status = code;
    }
}