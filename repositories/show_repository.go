package repositories

import (
	"anothapp-v3/database"
	"anothapp-v3/entities"
)

func GetUserShows(userId string) []entities.Show {
	var shows []entities.Show
	database.Db.Model(&entities.UserShow{}).
		Select("shows.*").
		Joins("JOIN shows ON shows.id = user_shows.show_id").
		Where("user_shows.user_id = ?", userId).
		Scan(&shows)
	return shows
}

func GetUserShow(userId string, showId int) entities.Show {
	var shows entities.Show
	database.Db.Model(&entities.UserShow{}).
		Select("shows.*").
		Joins("JOIN shows ON shows.id = user_shows.show_id").
		Where("user_shows.user_id = ? AND user_shows.show_id = ?", userId, showId).
		Scan(&shows)
	return shows
}
