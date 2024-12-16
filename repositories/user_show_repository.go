package repositories

import (
	"anothapp-v3/database"
	"anothapp-v3/entities"

	"gorm.io/gorm"
)

func GetUserShows(userId string) []entities.Show {
	var shows []entities.Show
	database.Db.Model(&entities.UserShow{}).
		Select("shows.*").
		Joins("JOIN shows ON shows.id = user_shows.show_id").
		Where("user_shows.user_id = ?", userId).
		Order("added_at DESC").
		Scan(&shows)
	return shows
}

func GetUserShow(userId string, showId int) *entities.Show {
	var shows *entities.Show
	res := database.Db.Model(&entities.UserShow{}).
		Select("shows.*").
		Joins("JOIN shows ON shows.id = user_shows.show_id").
		Where("user_shows.user_id = ? AND user_shows.show_id = ?", userId, showId).
		First(&shows)

	if res.Error == nil {
		return shows
	}
	return nil
}

func SaveUserShow(userShow entities.UserShow) *gorm.DB {
	return database.Db.Save(userShow)
}
