package entities

type Platform struct {
	ID   uint
	Name string `gorm:"type:varchar(50);not null;"`
	Logo string `gorm:"type:varchar(255);"`
}
