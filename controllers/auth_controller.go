package controllers

import (
	"anothapp-v3/models"
	"anothapp-v3/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Login(ctx *gin.Context) {

	var userDto models.UserLoginDto

	if err := ctx.ShouldBind(&userDto); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("Invalid form"))
		return
	}
	ok, token := services.Login(userDto.Identifier, userDto.Password)

	if ok {
		ctx.JSON(http.StatusOK, models.NewDataResponse("token", token))
	} else {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, models.NewResponse("Invalid username or password"))
	}
}

func Register(ctx *gin.Context) {

	var userDto models.UserSignUpDto

	if err := ctx.ShouldBind(&userDto); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("Invalid form"))
		return
	}
	code, response := services.Register(userDto)
	ctx.JSON(code, response)
}

func GetAuthUser(ctx *gin.Context) {

	userId := ctx.GetString("userId")
	user := services.FindUserById(userId)

	if user == nil {
		ctx.AbortWithStatus(http.StatusForbidden)
		return
	}
	ctx.JSON(http.StatusOK, models.UserDto{
		Email:    user.Email,
		Username: user.Username,
	})
}
