package entities

import "time"

type Friend struct {
	FstUserID string    `gorm:"constraint:OnDelete:CASCADE"`
	SecUserID string    `gorm:"constraint:OnDelete:CASCADE"`
	FriendAt  time.Time `gorm:"not null;"`
	Accepted  bool      `gorm:"default:false"`
}
