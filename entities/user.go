package entities

type User struct {
	ID          string `gorm:"primaryKey;type:varchar(50);"`
	Email       string `gorm:"unique;type:varchar(255);not null;"`
	Picture     string `gorm:"type:varchar(255);"`
	Password    string `gorm:"type:varchar(255);not null;"`
	Username    string `gorm:"type:varchar(50);not null;"`
	UserShows   []UserShow
	UserSeasons []UserSeason
}
