package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/models"
	"anothapp-v3/repositories"
	"anothapp-v3/utils"
)

func GetUserSeasonInfos(userId string, id, num int) []models.UserSeason {
	seasons := repositories.GetUserSeasonInfos(userId, id, num)
	return utils.Map(seasons, func(season entities.UserSeason) models.UserSeason {
		return models.NewUserSeason(season)
	})
}
