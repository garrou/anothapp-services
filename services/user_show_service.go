package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/models"
	"anothapp-v3/repositories"
	"anothapp-v3/utils"
	"strconv"
)

func GetUserShows(userId, status string) []models.ShowInfo {
	var userShows []entities.UserShow
	switch status {
	case "resume":
		userShows = repositories.GetUserShowsToResume(userId)
	case "not-started":
		userShows = repositories.GetUserListShows(userId)
	case "continue":
		userShows = repositories.GetUserShowsToContinue(userId)
	case "favorite":
		userShows = repositories.GetUserShowsFavorite(userId)
	case "shared":
	default:
		userShows = repositories.GetUserShows(userId)
	}
	return utils.Map(userShows, func(userShow entities.UserShow) models.ShowInfo {
		return *models.NewShowInfo(userShow)
	})
}

func GetUserShow(userId string, showId int) *models.ShowInfo {
	userShow := repositories.GetUserShow(userId, uint(showId))

	if userShow == nil {
		return nil
	}
	return models.NewShowInfo(*userShow)
}

func PostUserShow(userId string, showId int) bool {

	if exists := ShowExists(showId); !exists {
		apiShow := DisplayShow(strconv.Itoa(showId))

		if apiShow == nil {
			return false
		}
		if repositories.SaveShow(entities.Show{
			ID:            apiShow.Id,
			Title:         apiShow.Title,
			Poster:        apiShow.GetImageUrl(),
			Duration:      apiShow.Duration,
			SeasonsNumber: uint(len(apiShow.Seasons)),
			Country:       apiShow.Country,
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
	id := utils.BuildNum(showId)

	if id == nil {
		return false
	}
	result := repositories.DeleteUserShow(userId, *id)
	return result.Error == nil && result.RowsAffected == 1
}
