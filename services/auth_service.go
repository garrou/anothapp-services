package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/models"
	"anothapp-v3/repositories"
	"anothapp-v3/utils"

	"github.com/google/uuid"
)

func IsDuplicateUsername(username string) bool {
	res := repositories.UsernameExists(username)
	return res.Error == nil
}

func IsDuplicateEmail(email string) bool {
	res := repositories.EmailExists(email)
	return res.Error == nil
}

func FindUserById(id string) interface{} {
	return repositories.FindUserById(id)
}

func Register(user models.UserSignUpDto) bool {
	create := entities.User{
		ID:       uuid.New().String(),
		Email:    user.Email,
		Username: user.Username,
		Password: utils.HashPassword(user.Password),
	}
	res := repositories.SaveUser(create)
	return res.Error == nil
}

func Login(identifier, password string) interface{} {
	res := repositories.FindUserByIdentifier(identifier)

	if user, ok := res.(entities.User); ok {
		same := utils.ComparePassword(user.Password, password)

		if same {
			return res
		}
		return false
	}
	return false
}
