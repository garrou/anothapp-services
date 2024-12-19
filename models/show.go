package models

import (
	"anothapp-v3/entities"
	"time"
)

type PostShowDto struct {
	Id int `binding:"required" json:"id"`
}

type ShowInfo struct {
	ID       uint      `json:"id"`
	Title    string    `json:"title"`
	Poster   string    `json:"poster"`
	Duration uint      `json:"duration"`
	Seasons  uint      `json:"seasons"`
	Country  string    `json:"country"`
	Favorite bool      `json:"favorite"`
	Continue bool      `json:"continue"`
	AddedAt  time.Time `json:"addedAt"`
}

func NewShowInfo(userShow entities.UserShow) *ShowInfo {
	return &ShowInfo{
		ID:       userShow.ShowID,
		Title:    userShow.Show.Title,
		Poster:   userShow.Show.Poster,
		Duration: userShow.Show.Duration,
		Seasons:  userShow.Show.SeasonsNumber,
		Country:  userShow.Show.Country,
		Favorite: userShow.Favorite,
		Continue: userShow.Continue,
		AddedAt:  userShow.AddedAt,
	}
}
