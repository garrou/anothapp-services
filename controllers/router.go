package controllers

import (
	"anothapp-v3/middlewares"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func InitRouter() *gin.Engine {
	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins:  []string{os.Getenv("ORIGIN")},
		AllowMethods:  []string{"GET", "POST"},
		AllowHeaders:  []string{"Origin", "Authorization", "Content-Type"},
		ExposeHeaders: []string{"Content-Length"},
	}))

	apiV1 := router.Group("/v1")
	authRoutes := apiV1.Group("/auth")
	{
		authRoutes.POST("/register", Register)
		authRoutes.POST("/login", Login)
		authRoutes.Use(middlewares.AuthorizeJwt()).GET("/me", GetAuthUser)
	}

	showRoutes := apiV1.Group("/shows").Use(middlewares.AuthorizeJwt())
	{
		showRoutes.GET("/", GetUserShows)
		showRoutes.GET("/:id", GetUserShow)
	}

	return router
}
