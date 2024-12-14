package entities

type Kind struct {
	ID    string `gorm:"primaryKey;autoIncrement;"`
	Value string `gorm:"varchar(50);not null;"`
	Name  string `gorm:"varchar(50);not null;"`
}
