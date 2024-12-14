package repositories

import (
	"anothapp-v3/database"
	"anothapp-v3/entities"

	"gorm.io/gorm"
)

func SaveUser(user entities.User) *gorm.DB {
	return database.Db.Save(&user)
}

func FindUserByIdentifier(identifier string) interface{} {
	var user entities.User
	database.Db.Find(&user, "username = ? OR email = ?", identifier, identifier)
	return user
}

func FindUserByUsername(username string) interface{} {
	var user entities.User
	database.Db.Find(&user, "username = ?", username)
	return user
}

func FindUserByEmail(email string) interface{} {
	var user entities.User
	database.Db.Find(&user, "email = ?", email)
	return user
}

func FindUserById(id string) interface{} {
	var user entities.User
	database.Db.Find(&user, "id = ?", id)
	return user
}

func UsernameExists(username string) *gorm.DB {
	return database.Db.Take(&entities.User{}, "username = ?", username)
}

func EmailExists(email string) *gorm.DB {
	return database.Db.Take(&entities.User{}, "email = ?", email)
}
