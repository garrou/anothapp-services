package entities

type Platform struct {
	ID   int
	Name string `gorm:"type:varchar(50);not null;"`
	Logo string `gorm:"type:varchar(255);"`
}
