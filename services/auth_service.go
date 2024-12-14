package services

import (
	"anothapp-v3/entities"
	"anothapp-v3/models"
	"anothapp-v3/repositories"
	"anothapp-v3/utils"
	"net/http"

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

func FindUserById(id string) *entities.User {
	return repositories.FindUserById(id)
}

func Register(user models.UserSignUpDto) (int, models.Response) {
	if IsDuplicateUsername(user.Username) {
		return http.StatusConflict, models.NewResponse("An account already exists with this username")
	} else if IsDuplicateEmail(user.Email) {
		return http.StatusConflict, models.NewResponse("An account already exists with this email")
	}
	res := repositories.SaveUser(entities.User{
		ID:       uuid.New().String(),
		Email:    user.Email,
		Username: user.Username,
		Password: utils.HashPassword(user.Password),
	})

	if res.Error == nil {
		return http.StatusOK, models.NewResponse("Account created")
	}
	return http.StatusInternalServerError, models.NewResponse("Error during account creation")
}

func Login(identifier, password string) (bool, string) {
	user := repositories.FindUserByIdentifier(identifier)

	if user != nil {
		same := utils.ComparePassword(user.Password, password)

		if same {
			return true, utils.GenerateToken(user.ID)
		}
	}
	return false, ""
}
