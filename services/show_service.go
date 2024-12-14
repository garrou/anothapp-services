package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/repositories"
)

func GetUserShows(userId string) []entities.Show {
	return repositories.GetUserShows(userId)
}

func GetUserShow(userId string, showId int) entities.Show {
	return repositories.GetUserShow(userId, showId)
}
