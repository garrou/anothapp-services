package controllers

import (
	"anothapp-v3/middlewares"
	"anothapp-v3/models"
	"anothapp-v3/services"
	"anothapp-v3/utils"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func GetUserShows(ctx *gin.Context) {
	status := ctx.Query("status")
	shows := services.GetUserShows(ctx.GetString(middlewares.UserId), status)
	ctx.JSON(http.StatusOK, shows)
}

func GetUserShow(ctx *gin.Context) {
	showId, err := strconv.Atoi(ctx.Param("id"))

	if err != nil {
		ctx.JSON(http.StatusBadRequest, models.NewResponse("Données erronées"))
	} else if show := services.GetUserShow(ctx.GetString(middlewares.UserId), showId); show == nil {
		ctx.JSON(http.StatusNotFound, models.NewResponse("Série non trouvée"))
	} else {
		ctx.JSON(http.StatusOK, show)
	}
}

func PostUserShow(ctx *gin.Context) {
	var showDto models.PostShowDto

	if err := ctx.ShouldBind(&showDto); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("Invalid form"))
		return
	}
	userId := ctx.GetString(middlewares.UserId)

	if show := services.GetUserShow(userId, showDto.Id); show != nil {
		ctx.AbortWithStatusJSON(http.StatusConflict, models.NewResponse("Cette série est déjà dans votre collection"))
	} else if saved := services.PostUserShow(userId, showDto.Id); saved {
		ctx.JSON(http.StatusCreated, models.NewResponse("Série ajoutée"))
	} else {
		ctx.JSON(http.StatusInternalServerError, models.NewResponse("Erreur durant l'ajout"))
	}
}

func DeleteUserShow(ctx *gin.Context) {

	if deleted := services.DeleteUserShow(ctx.GetString(middlewares.UserId), ctx.Param("id")); deleted {
		ctx.JSON(http.StatusOK, models.NewResponse("Série supprimée"))
	} else {
		ctx.JSON(http.StatusInternalServerError, models.NewResponse("Erreur durant la suppression"))
	}
}

func GetSeasonInfo(ctx *gin.Context) {
	id := utils.BuildNum(ctx.Param("id"))
	num := utils.BuildNum(ctx.Param("num"))

	if id == nil || num == nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("Requête invalide"))
		return
	}
	userSeasons := services.GetUserSeasonInfos(ctx.GetString("userId"), *id, *num)
	ctx.JSON(http.StatusOK, userSeasons)
}
