package services

import (
	"anothapp-v3/models"
	"anothapp-v3/repositories"
)

func GetUserProfile(id string) *models.UserProfileDto {
	user := repositories.FindUserById(id)

	if user == nil {
		return nil
	}
	return &models.UserProfileDto{
		Id:       user.ID,
		Email:    user.Email,
		Username: user.Username,
		Picture:  user.Picture,
	}
}
