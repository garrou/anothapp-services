package repositories

import (
	"anothapp-v3/database"
	"anothapp-v3/entities"

	"gorm.io/gorm"
)

func SaveUser(user entities.User) *gorm.DB {
	return database.Db.Save(&user)
}

func FindUserByIdentifier(identifier string) *entities.User {
	user := &entities.User{}
	res := database.Db.Find(user, "username = ? OR email = ?", identifier, identifier)

	if res.Error == nil {
		return user
	}
	return nil
}

func FindUserByUsername(username string) *entities.User {
	user := &entities.User{}
	res := database.Db.Find(user, "username = ?", username)

	if res.Error == nil {
		return user
	}
	return nil
}

func FindUserByEmail(email string) *entities.User {
	user := &entities.User{}
	res := database.Db.Find(user, "email = ?", email)

	if res.Error == nil {
		return user
	}
	return nil
}

func FindUserById(id string) *entities.User {
	user := &entities.User{}
	res := database.Db.Find(user, "id = ?", id)

	if res.Error == nil {
		return user
	}
	return nil
}

func UsernameExists(username string) *gorm.DB {
	return database.Db.Take(&entities.User{}, "username = ?", username)
}

func EmailExists(email string) *gorm.DB {
	return database.Db.Take(&entities.User{}, "email = ?", email)
}
