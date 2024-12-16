package middlewares

import (
	"anothapp-v3/models"
	"anothapp-v3/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const Bearer = "Bearer "
const UserId = "userId"

func AuthorizeJwt() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		authHeader := ctx.GetHeader("Authorization")

		if !strings.Contains(authHeader, Bearer) {
			ctx.AbortWithStatusJSON(http.StatusBadRequest, models.NewResponse("User not authenticated"))
			return
		}
		bearer := authHeader[len(Bearer):]
		token, err := utils.ValidateToken(bearer)

		if !token.Valid || err != nil {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, models.NewResponse("Invalid token"))
			return
		}
		ctx.Set(UserId, utils.ExtractUserId(token))
	}
}
