package models

import (
	"anothapp-v3/entities"
	"time"
)

type UserSeason struct {
	Id       uint              `json:"id"`
	AddedAt  time.Time         `json:"addedAt"`
	Platform entities.Platform `json:"platform"`
}

func NewUserSeason(season entities.UserSeason) UserSeason {
	return UserSeason{
		Id:       season.ID,
		AddedAt:  season.AddedAt,
		Platform: season.Platform,
	}
}
