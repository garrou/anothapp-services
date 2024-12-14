package middlewares

import (
	"anothapp-v3/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const BEARER = "Bearer "

func AuthorizeJwt() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if !strings.Contains(authHeader, BEARER) {
			c.AbortWithStatusJSON(http.StatusBadRequest, utils.NewResponse("User not authenticated", nil))
			return
		}
		bearer := authHeader[len(BEARER):]
		token, err := utils.ValidateToken(bearer)

		if !token.Valid || err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, utils.NewResponse("Invalid token", nil))
			return
		}
		c.Set("userId", utils.ExtractUserId(token))
	}
}
