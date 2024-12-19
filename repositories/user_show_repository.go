package repositories

import (
	"anothapp-v3/database"
	"anothapp-v3/entities"
	"gorm.io/gorm"
)

func GetUserShows(userId string) []entities.UserShow {
	var shows []entities.UserShow
	database.Db.Model(&entities.UserShow{}).
		Joins("Show").
		Order("added_at DESC").
		Find(&shows, &entities.UserShow{UserID: userId})
	return shows
}

func GetUserShow(userId string, showId uint) *entities.UserShow {
	var shows *entities.UserShow
	res := database.Db.Model(&entities.UserShow{}).
		Joins("Show").
		First(&shows, &entities.UserShow{UserID: userId, ShowID: showId})

	if res.Error == nil {
		return shows
	}
	return nil
}

func GetUserShowsToResume(userId string) []entities.UserShow {
	var shows []entities.UserShow
	database.Db.Table("user_shows us").
		Joins("JOIN shows s ON s.id = us.show_id").
		Order("title").
		Find(&shows, `us.user_id = ? AND us.continue = FALSE AND s.seasons_number - (
			SELECT COUNT(distinct number)
			FROM shows
	        JOIN user_seasons ON s.id = user_seasons.show_id 
			WHERE user_seasons.user_id = us.user_id and s.id = shows.id) > 0`, userId)
	return shows
}

func GetUserListShows(userId string) []entities.UserShow {
	var shows []entities.UserShow
	database.Db.Model(&entities.UserList{}).
		Joins("Show").
		Find(&shows, &entities.UserList{UserID: userId})
	return shows
}

func GetUserShowsToContinue(userId string) []entities.UserShow {
	var shows []entities.UserShow
	database.Db.Table("shows s").
		Select(`s.*, us.added_at, us.continue, us.favorite, s.seasons - (
	        SELECT COUNT(distinct user_seasons.number)
	        FROM shows
	        JOIN user_seasons ON s.id = user_seasons.show_id 
	        WHERE user_seasons.user_id = ? and s.id = shows.id
        ) as missing, us.added_at, us.continue, us.favorite`, userId).
		Joins("JOIN user_shows us ON s.id = us.show_id").
		Where(`us.user_id = ? AND us.continue = TRUE`, userId).
		Order("s.title DESC").
		Find(&shows)
	return shows
}

func GetUserShowsFavorite(userId string) []entities.UserShow {
	var shows []entities.UserShow
	database.Db.Model(&entities.UserShow{}).
		Joins("Show").
		Order("title").
		Find(&shows, &entities.UserShow{UserID: userId, Favorite: true})
	return shows
}

func SaveUserShow(userShow entities.UserShow) *gorm.DB {
	return database.Db.Save(userShow)
}

func DeleteUserShow(userId string, showId int) *gorm.DB {
	return database.Db.Model(&entities.UserShow{}).
		Delete(&entities.UserShow{}).
		Where("show_id = ? AND user_id = ?", showId, userId)
}
