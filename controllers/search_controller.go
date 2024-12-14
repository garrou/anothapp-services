package controllers

import (
	"anothapp-v3/models"
	"anothapp-v3/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

func DiscoverShowsImages(ctx *gin.Context) {
	images := services.DiscoverShowsImages(ctx.Query("limit"))
	ctx.JSON(http.StatusOK, images)
}

func DiscoverShows(ctx *gin.Context) {
	shows := services.DiscoverShows(ctx.Query("limit"))
	ctx.JSON(http.StatusOK, shows)
}

func DisplayShow(ctx *gin.Context) {
	show := services.DisplayShow(ctx.Param("id"))

	if show == nil {
		ctx.AbortWithStatusJSON(http.StatusNotFound, models.NewResponse("Série non trouvée"))
		return
	}
	ctx.JSON(http.StatusOK, show)
}
