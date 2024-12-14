package models

type Response struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func NewResponse(message string) Response {
	return Response{Message: message}
}

func NewDataResponse(message string, data interface{}) Response {
	return Response{
		Message: message,
		Data:    data,
	}
}
