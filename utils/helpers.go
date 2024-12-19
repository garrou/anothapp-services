package utils

func Filter[T any](array []T, predicate func(T) bool) (ret []T) {
	for _, value := range array {
		if predicate(value) {
			ret = append(ret, value)
		}
	}
	return
}

func Map[T, U any](array []T, fn func(T) U) []U {
	result := make([]U, len(array))
	for i, value := range array {
		result[i] = fn(value)
	}
	return result
}
