package utils

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

const BaseUrl = "https://api.betaseries.com"
const DefaultLimit = 20
const DefaultId = -1

var ApiKey string

func BuildLimit(limit string) int {
	if limit == "" {
		return DefaultLimit
	}
	if number, err := strconv.Atoi(limit); err == nil {
		return number
	}
	return DefaultLimit
}

func BuildId(id string) int {
	if id == "" {
		return DefaultId
	}
	if number, err := strconv.Atoi(id); err == nil {
		return number
	}
	return DefaultId
}

func addApiKey(url string) string {
	if strings.Contains(url, "?") {
		return fmt.Sprintf("%s&key=%s", url, ApiKey)
	}
	return fmt.Sprintf("%s?key=%s", url, ApiKey)
}

func buildUrl(url string) string {
	return fmt.Sprintf("%s%s", BaseUrl, url)
}

func HttpGet(url string) []byte {
	apiUrl := buildUrl(url)
	fullUrl := addApiKey(apiUrl)
	resp, err := http.Get(fullUrl)

	if err != nil {
		panic(err.Error())
	}
	defer func(body io.ReadCloser) {
		if err := body.Close(); err != nil {
			panic(err.Error())
		}
	}(resp.Body)

	body, err := io.ReadAll(resp.Body)

	if err != nil {
		panic(err.Error())
	}
	return body
}
