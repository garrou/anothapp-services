package entities

import "time"

type UserSeason struct {
	ID         uint      `gorm:"autoIncrement;"`
	AddedAt    time.Time `gorm:"default:CURRENT_TIMESTAMP;"`
	UserID     string
	User       User `gorm:"constraint:OnDelete:CASCADE"`
	ShowID     uint
	Show       Show `gorm:"constraint:OnDelete:CASCADE"`
	Number     uint `gorm:"not null;"`
	PlatformID uint
	Platform   Platform `gorm:"constraint:OnUpdate:CASCADE"`
}
