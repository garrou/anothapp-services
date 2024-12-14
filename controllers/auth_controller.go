package controllers

import (
	"anothapp-v3/entities"
	"anothapp-v3/models"
	"anothapp-v3/services"
	"anothapp-v3/utils"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Login(ctx *gin.Context) {

	var userDto models.UserLoginDto

	if err := ctx.ShouldBind(&userDto); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, utils.NewResponse("Invalid form", err.Error()))
		return
	}
	res := services.Login(userDto.Identifier, userDto.Password)

	if user, ok := res.(entities.User); ok {
		token := utils.GenerateToken(user.ID)
		ctx.JSON(http.StatusOK, utils.NewResponse("token", token))
	} else {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, utils.NewResponse("Invalid username or password", nil))
	}
}

func Register(ctx *gin.Context) {

	var userDto models.UserSignUpDto

	if err := ctx.ShouldBind(&userDto); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, utils.NewResponse("Invalid form", err.Error()))
		return
	}
	if services.IsDuplicateUsername(userDto.Username) {
		ctx.AbortWithStatusJSON(http.StatusConflict, utils.NewResponse("An account already exists with this username", nil))
		return
	} else if services.IsDuplicateEmail(userDto.Email) {
		ctx.AbortWithStatusJSON(http.StatusConflict, utils.NewResponse("An account already exists with this email", nil))
		return
	}
	if created := services.Register(userDto); created {
		ctx.JSON(http.StatusCreated, utils.NewResponse("Account created", nil))
	} else {
		ctx.JSON(http.StatusInternalServerError, utils.NewResponse("Error during account creation", nil))
	}
}

func GetAuthUser(ctx *gin.Context) {

	userId := ctx.GetString("userId")
	res := services.FindUserById(userId)

	if user, ok := res.(entities.User); ok {
		ctx.JSON(http.StatusOK, models.UserDto{
			Email:    user.Email,
			Username: user.Username,
		})
	} else {
		ctx.AbortWithStatus(http.StatusForbidden)
	}
}
