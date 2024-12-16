package controllers

import (
	"anothapp-v3/models"
	"anothapp-v3/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetDiscoverShowsImages(ctx *gin.Context) {
	images := services.DiscoverShowsImages(ctx.Query("limit"))
	ctx.JSON(http.StatusOK, images)
}

func GetDiscoverShows(ctx *gin.Context) {
	shows := services.DiscoverShows(ctx.Query("limit"))
	ctx.JSON(http.StatusOK, shows)
}

func GetDisplayShow(ctx *gin.Context) {
	if show := services.DisplayShow(ctx.Param("id")); show == nil {
		ctx.JSON(http.StatusNotFound, models.NewResponse("Série non trouvée"))
	} else {
		ctx.JSON(http.StatusOK, show)
	}
}
