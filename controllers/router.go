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
		showRoutes.POST("/")
		showRoutes.DELETE("/:id")
		showRoutes.PATCH("/:id")
		showRoutes.POST("/:id/seasons")
		showRoutes.GET("/:id/seasons/:num")
	}

	seasonRoutes := apiV1.Group("/seasons").Use(middlewares.AuthorizeJwt())
	{
		seasonRoutes.GET("/")
		seasonRoutes.PATCH("/:id")
		seasonRoutes.DELETE("/:id")
	}

	statRoutes := apiV1.Group("/stats").Use(middlewares.AuthorizeJwt())
	{
		statRoutes.GET("/")
		statRoutes.GET("/count")
		statRoutes.GET("time")
		statRoutes.GET("/grouped-count")
	}

	searchRoutes := apiV1.Group("/search").Use(middlewares.AuthorizeJwt())
	{
		searchRoutes.GET("/images", DiscoverShowsImages)
		searchRoutes.GET("/shows", DiscoverShows)
		searchRoutes.GET("/shows/:id", DisplayShow)
		searchRoutes.GET("/shows/:id/seasons")
		searchRoutes.GET("/shows/:id/characters")
		searchRoutes.GET("/shows/:id/similars")
		searchRoutes.GET("/shows/:id/images")
		searchRoutes.GET("/kinds")
		searchRoutes.GET("/platforms")
		searchRoutes.GET("/persons/:id")
	}

	friendRoutes := apiV1.Group("/friends").Use(middlewares.AuthorizeJwt())
	{
		friendRoutes.GET("/")
		friendRoutes.POST("/")
		friendRoutes.PATCH("/:id")
		friendRoutes.DELETE("/:id")
	}

	return router
}
