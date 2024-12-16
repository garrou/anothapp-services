package entities

type UserList struct {
	UserID string `gorm:"primary_key"`
	User   User
	ShowID uint `gorm:"primary_key"`
	Show   Show
}
