package entities

import "time"

type Friend struct {
	FstUserID string
	FstUser   User `gorm:"constraint:OnDelete:CASCADE"`
	SecUserID string
	SecUser   User      `gorm:"constraint:OnDelete:CASCADE"`
	FriendAt  time.Time `gorm:"not null;"`
	Accepted  bool      `gorm:"default:false"`
}
