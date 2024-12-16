package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/repositories"
	"strconv"
)

func GetUserShows(userId string) []entities.Show {
	return repositories.GetUserShows(userId)
}

func GetUserShow(userId string, showId int) *entities.Show {
	return repositories.GetUserShow(userId, showId)
}

func PostUserShow(userId string, showId int) bool {

	if exists := ShowExists(showId); !exists {
		apiShow := DisplayShow(strconv.Itoa(showId))

		if apiShow == nil {
			return false
		}
		if repositories.SaveShow(entities.Show{
			ID:       uint(apiShow.Id),
			Title:    apiShow.Title,
			Poster:   apiShow.GetImageUrl(),
			Duration: apiShow.Duration,
			Seasons:  uint(len(apiShow.Seasons)),
			Country:  apiShow.Country,
		}).Error != nil {
			return false
		}
	}
	return repositories.SaveUserShow(entities.UserShow{
		UserID: userId,
		ShowID: uint(showId),
	}).Error == nil
}
