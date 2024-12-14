package entities

type Kind struct {
	ID   uint   `gorm:"primaryKey;autoIncrement;"`
	Name string `gorm:"varchar(50);not null;"`
}
