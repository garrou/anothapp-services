export const errorHandler = (err, req, res, _) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
};