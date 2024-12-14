package entities

import "time"

type UserSeason struct {
	ID         uint      `gorm:"autoIncrement;"`
	AddedAt    time.Time `gorm:"default:CURRENT_TIMESTAMP;not null;"`
	UserID     string
	User       User
	ShowID     int
	Show       Show
	Number     uint `gorm:"not null;"`
	PlatformID int
	Platform   Platform
}
