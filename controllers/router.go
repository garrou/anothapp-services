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

	authRoutes := router.Group("/auth")
	{
		authRoutes.POST("/register", Register)
		authRoutes.POST("/login", Login)
		authRoutes.Use(middlewares.AuthorizeJwt()).GET("/me", GetAuthUser)
	}

	userRoutes := router.Group("/users").Use(middlewares.AuthorizeJwt())
	{
		userRoutes.GET("/profile", GetProfile)
		userRoutes.GET("/:id/profile", GetUserProfile)
	}

	showRoutes := router.Group("/shows").Use(middlewares.AuthorizeJwt())
	{
		showRoutes.GET("", GetUserShows)
		showRoutes.GET("/:id", GetUserShow)
		showRoutes.POST("", PostUserShow)
		showRoutes.DELETE("/:id", DeleteUserShow)
		showRoutes.PATCH("/:id")
		showRoutes.POST("/:id/seasons")
		showRoutes.GET("/:id/seasons/:num", GetSeasonInfo)
	}

	seasonRoutes := router.Group("/seasons").Use(middlewares.AuthorizeJwt())
	{
		seasonRoutes.GET("")
		seasonRoutes.PATCH("/:id")
		seasonRoutes.DELETE("/:id")
	}

	statRoutes := router.Group("/stats").Use(middlewares.AuthorizeJwt())
	{
		statRoutes.GET("/")
		statRoutes.GET("/count")
		statRoutes.GET("time")
		statRoutes.GET("/grouped-count")
	}

	searchRoutes := router.Group("/search").Use(middlewares.AuthorizeJwt())
	{
		searchRoutes.GET("/images", GetDiscoverShowsImages)
		searchRoutes.GET("/shows", GetDiscoverShows)
		searchRoutes.GET("/shows/:id", GetDisplayShow)
		searchRoutes.GET("/shows/:id/seasons")
		searchRoutes.GET("/shows/:id/characters")
		searchRoutes.GET("/shows/:id/similars")
		searchRoutes.GET("/shows/:id/images")
		searchRoutes.GET("/kinds")
		searchRoutes.GET("/platforms")
		searchRoutes.GET("/persons/:id")
	}

	friendRoutes := router.Group("/friends").Use(middlewares.AuthorizeJwt())
	{
		friendRoutes.GET("/")
		friendRoutes.POST("/")
		friendRoutes.PATCH("/:id")
		friendRoutes.DELETE("/:id")
	}

	return router
}
