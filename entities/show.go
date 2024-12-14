package entities

type Show struct {
	ID        int    `gorm:"primaryKey;"`
	Title     string `gorm:"type:varchar(255);not null;"`
	Poster    string `gorm:"type:varchar(255);"`
	Duration  uint   `gorm:"not null;"`
	Seasons   uint   `gorm:"not null;"`
	Country   string `gorm:"type:varchar(255);not null;"`
	ShowKinds []ShowKind
}
