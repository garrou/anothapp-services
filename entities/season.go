package entities

type Season struct {
	Number   uint   `gorm:"not null;"`
	Episodes uint   `gorm:"not null;"`
	Image    string `gorm:"varchar(255);"`
	ShowID   uint   `gorm:"constraint:OnDelete:CASCADE"`
}
