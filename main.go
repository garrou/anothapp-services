package main

import (
	"anothapp-v3/controllers"
	"anothapp-v3/database"
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {

	if err := godotenv.Load(); err != nil {
		panic(err.Error())
	}
	database.Open()
	defer database.Close()

	gin.SetMode(os.Getenv("GIN_MODE"))
	router := controllers.InitRouter()

	if err := router.SetTrustedProxies(nil); err != nil {
		panic(err.Error())
	}
	if err := router.Run(fmt.Sprintf(":%s", os.Getenv("PORT"))); err != nil {
		log.Fatal(err)
	}
}
