package middlewares

import (
	"anothapp-v3/models"
	"anothapp-v3/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const BEARER = "Bearer "

func AuthorizeJwt() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		authHeader := ctx.GetHeader("Authorization")

		if !strings.Contains(authHeader, BEARER) {
			ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("User not authenticated"))
			return
		}
		bearer := authHeader[len(BEARER):]
		token, err := utils.ValidateToken(bearer)

		if !token.Valid || err != nil {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, models.NewResponse("Invalid token"))
			return
		}
		ctx.Set("userId", utils.ExtractUserId(token))
	}
}
