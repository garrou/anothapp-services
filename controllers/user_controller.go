package controllers

import (
	"anothapp-v3/middlewares"
	"anothapp-v3/models"
	"anothapp-v3/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetProfile(ctx *gin.Context) {
	if profile := services.GetUserProfile(ctx.GetString(middlewares.UserId)); profile == nil {
		ctx.JSON(http.StatusNotFound, models.NewResponse("Utilisateur non trouvé"))
	} else {
		ctx.JSON(http.StatusOK, profile)
	}
}

func GetUserProfile(ctx *gin.Context) {
	id := ctx.Param("id")

	if id == "" {
		ctx.JSON(http.StatusBadRequest, models.NewResponse("Identifiant utilisateur manquant"))
	} else if profile := services.GetUserProfile(id); profile == nil {
		ctx.JSON(http.StatusNotFound, models.NewResponse("Utilisateur non trouvé"))
	} else {
		ctx.JSON(http.StatusOK, profile)
	}
}
