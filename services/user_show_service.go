package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/repositories"
	"anothapp-v3/utils"
	"strconv"
)

func GetUserShows(userId, status string) []entities.Show {
	switch status {
	case "resume":
		return repositories.GetUserShowsToResume(userId)
	case "not-started":
		return repositories.GetUserListShows(userId)
	case "continue":
		return repositories.GetUserShowsToContinue(userId)
	case "favorite":
		return repositories.GetUserShowsFavorite(userId)
	case "shared":
		// TODO
	}
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

func DeleteUserShow(userId string, showId string) bool {
	id := utils.BuildId(showId)

	if id == nil {
		return false
	}
	return repositories.DeleteUserShow(userId, *id).Error == nil
}
