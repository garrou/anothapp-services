package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/models"
	"anothapp-v3/repositories"
	"anothapp-v3/utils"

	"github.com/google/uuid"
)

func IsDuplicateUsername(username string) bool {
	return repositories.UsernameExists(username).Error == nil
}

func IsDuplicateEmail(email string) bool {
	return repositories.EmailExists(email).Error == nil
}

func GetUserById(id string) *entities.User {
	return repositories.FindUserById(id)
}

func Register(user models.UserSignUpDto) bool {
	res := repositories.SaveUser(entities.User{
		ID:       uuid.New().String(),
		Email:    user.Email,
		Username: user.Username,
		Password: utils.HashPassword(user.Password),
	})
	return res.Error == nil
}

func Login(identifier, password string) string {
	user := repositories.FindUserByIdentifier(identifier)

	if user != nil {
		same := utils.ComparePassword(user.Password, password)

		if same {
			return utils.GenerateToken(user.ID)
		}
	}
	return ""
}
