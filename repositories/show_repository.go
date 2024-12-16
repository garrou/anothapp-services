package repositories

import (
	"anothapp-v3/database"
	"anothapp-v3/entities"

	"gorm.io/gorm"
)

func GetShowById(id int) *entities.Show {
	var show *entities.Show
	res := database.Db.First(&show, "id = ?", id)

	if res.Error == nil {
		return show
	}
	return nil
}

func ShowExists(id int) *gorm.DB {
	return database.Db.Take(&entities.Show{}, "id = ?", id)
}

func SaveShow(show entities.Show) *gorm.DB {
	return database.Db.Save(show)
}
