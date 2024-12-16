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
		Order("user_shows.added_at DESC").
		Scan(&shows)
	return shows
}

func GetUserShowsToResume(userId string) []entities.Show {
	var shows []entities.Show
	database.Db.Table("shows s").
		Select("s.*, us.favorite, us.added_at, us.continue").
		Joins("JOIN user_shows us ON s.id = us.show_id").
		Where(`us.user_id = ? AND us.continue = FALSE AND s.seasons - (
			SELECT COUNT(distinct number)
	        FROM shows
	        JOIN user_seasons ON s.id = user_seasons.show_id 
	        WHERE user_seasons.user_id = us.user_id and s.id = shows.id) > 0`, userId).
		Order("s.title").
		Scan(&shows)
	return shows
}

func GetUserListShows(userId string) []entities.Show {
	var shows []entities.Show
	database.Db.Model(&entities.UserList{}).
		Joins("JOIN shows ON shows.id = show_id").
		Where("user_id = ?", userId).
		Scan(&shows)
	return shows
}

func GetUserShowsToContinue(userId string) []entities.Show {
	var shows []entities.Show
	database.Db.Table("shows s").
		Select(`s.*, s.seasons - (
	        SELECT COUNT(distinct user_seasons.number)
	        FROM shows
	        JOIN user_seasons ON s.id = user_seasons.show_id 
	        WHERE user_seasons.user_id = ? and s.id = shows.id
        ) as missing, us.added_at, us.continue, us.favorite`, userId).
		Joins("JOIN user_shows us ON s.id = us.show_id").
		Where(`us.user_id = ? AND us.continue = TRUE`, userId).
		Order("s.title DESC").
		Scan(&shows)
	return shows
}

func GetUserShowsFavorite(userId string) []entities.Show {
	var shows []entities.Show
	database.Db.Model(&entities.UserShow{}).
		Joins("JOIN shows ON shows.id = user_shows.show_id").
		Where(`user_shows.user_id = ? AND user_shows.favorite = TRUE`, userId).
		Order("title").
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

func DeleteUserShow(userId string, showId int) *gorm.DB {
	return database.Db.Model(&entities.UserShow{}).
		Delete(&entities.UserShow{}).
		Where("show_id = ? AND user_id = ?", showId, userId)
}
