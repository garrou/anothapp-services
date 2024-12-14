package entities

import "time"

type Friend struct {
	FstUserID string
	FstUser   User `gorm:"foreignKey:FstUserID"`
	SecUserID string
	SecUser   User      `gorm:"foreignKey:SecUserID"`
	FrientAt  time.Time `gorm:"not null;"`
	Accepted  bool      `gorm:"default:false"`
}
