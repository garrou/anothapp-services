package controllers

import (
	"anothapp-v3/models"
	"anothapp-v3/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func GetUserShows(ctx *gin.Context) {
	userId := ctx.GetString("userId")
	shows := services.GetUserShows(userId)
	ctx.JSON(http.StatusOK, shows)
}

func GetUserShow(ctx *gin.Context) {
	showId, err := strconv.Atoi(ctx.Param("id"))

	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("Données erronées"))
		return
	}
	userId := ctx.GetString("userId")
	shows := services.GetUserShow(userId, showId)
	ctx.JSON(http.StatusOK, shows)
}
