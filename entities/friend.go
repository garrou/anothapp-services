package entities

import "time"

type Friend struct {
	FstUserID string
	FstUser   User
	SecUserID string
	SecUser   User
	FriendAt  time.Time `gorm:"not null;"`
	Accepted  bool      `gorm:"default:false"`
}
