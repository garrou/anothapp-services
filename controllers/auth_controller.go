package controllers

import (
	"anothapp-v3/middlewares"
	"anothapp-v3/models"
	"anothapp-v3/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Login(ctx *gin.Context) {

	var userDto models.UserLoginDto

	if err := ctx.ShouldBind(&userDto); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("Invalid form"))
	} else if token := services.Login(userDto.Identifier, userDto.Password); token == "" {
		ctx.JSON(http.StatusUnauthorized, models.NewResponse("Invalid username or password"))
	} else {
		ctx.JSON(http.StatusOK, models.NewDataResponse("token", token))
	}
}

func Register(ctx *gin.Context) {

	var userDto models.UserSignUpDto

	if err := ctx.ShouldBind(&userDto); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("Données invalides"))
	} else if services.IsDuplicateUsername(userDto.Username) {
		ctx.AbortWithStatusJSON(http.StatusConflict, models.NewResponse("Un compte est associé à ce nom"))
	} else if services.IsDuplicateEmail(userDto.Email) {
		ctx.AbortWithStatusJSON(http.StatusConflict, models.NewResponse("Un compte est associé à cet email"))
	} else if created := services.Register(userDto); created {
		ctx.JSON(http.StatusCreated, models.NewResponse("Account created"))
	} else {
		ctx.JSON(http.StatusInternalServerError, models.NewResponse("Error during account creation"))
	}
}

func GetAuthUser(ctx *gin.Context) {
	userId := ctx.GetString(middlewares.UserId)

	if user := services.GetUserById(userId); user == nil {
		ctx.Status(http.StatusNotFound)
	} else {
		ctx.Status(http.StatusOK)
	}
}
