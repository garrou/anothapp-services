package entities

import "time"

type UserSeason struct {
	ID         uint      `gorm:"autoIncrement;"`
	AddedAt    time.Time `gorm:"default:CURRENT_TIMESTAMP;"`
	UserID     string
	User       User
	ShowID     uint
	Show       Show
	Number     uint `gorm:"not null;"`
	PlatformID uint
	Platform   Platform
}
