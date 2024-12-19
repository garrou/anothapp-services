package repositories

import (
	"anothapp-v3/database"
	"anothapp-v3/entities"
)

func GetUserSeasonInfos(userId string, id, num int) []entities.UserSeason {
	var userSeasons []entities.UserSeason
	database.Db.
		Joins("Platform").
		Select("user_seasons.id, added_at").
		Find(&userSeasons, "user_id = ? AND show_id = ? AND number = ? ", userId, id, num)
	return userSeasons
}
