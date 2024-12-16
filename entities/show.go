package entities

type Show struct {
	ID        uint       `gorm:"primaryKey;" json:"id"`
	Title     string     `gorm:"type:varchar(255);not null;" json:"title"`
	Poster    string     `gorm:"type:varchar(255);" json:"poster"`
	Duration  uint       `gorm:"not null;" json:"duration"`
	Seasons   uint       `gorm:"not null;" json:"seasons"`
	Country   string     `gorm:"type:varchar(255);not null;" json:"country"`
	ShowKinds []ShowKind `json:"kinds"`
}
