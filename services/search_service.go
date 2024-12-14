package services

import (
	"anothapp-v3/models"
	"anothapp-v3/utils"
	"encoding/json"
	"fmt"
)

func DiscoverShowsImages(limit string) []string {
	var urls []string

	for _, show := range DiscoverShows(limit) {
		urls = append(urls, show.GetImageUrl())
	}
	return urls
}

func DiscoverShows(limit string) []models.ApiShow {
	body := utils.HttpGet(fmt.Sprintf("/shows/discover?limit=%d", utils.BuildLimit(limit)))
	var apiShows models.DiscoverApiShows

	if err := json.Unmarshal(body, &apiShows); err != nil {
		return []models.ApiShow{}
	}
	return apiShows.Shows
}

func DisplayShow(id string) *models.ApiShow {
	body := utils.HttpGet(fmt.Sprintf("/shows/display?id=%d", utils.BuildId(id)))
	var show models.DisplayApiShow

	if err := json.Unmarshal(body, &show); err != nil {
		return nil
	}
	return &show.Show
}
