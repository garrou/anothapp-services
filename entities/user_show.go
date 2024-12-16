package entities

import "time"

type UserShow struct {
	Continue bool      `gorm:"default:true"`
	AddedAt  time.Time `gorm:"default:CURRENT_TIMESTAMP;"`
	UserID   string    `gorm:"primaryKey"`
	User     User      `gorm:"foreignKey:UserID"`
	ShowID   uint      `gorm:"primaryKey"`
	Show     Show      `gorm:"foreignKey:ShowID"`
	Favorite bool      `gorm:"default:false"`
}
