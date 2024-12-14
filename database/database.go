package database

import (
	"anothapp-v3/entities"
	"fmt"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var Db *gorm.DB

func Open() {
	user := os.Getenv("POSTGRES_USER")
	pass := os.Getenv("POSTGRES_PASSWORD")
	host := os.Getenv("POSTGRES_HOST")
	name := os.Getenv("POSTGRES_DB")
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s", host, user, pass, name)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})

	if err != nil {
		panic(err.Error())
	}
	if errMigrate := db.AutoMigrate(
		&entities.User{},
		&entities.Show{},
		&entities.UserShow{},
		&entities.Kind{},
		&entities.ShowKind{},
		&entities.Season{},
		&entities.UserSeason{},
		&entities.Platform{},
		&entities.Friend{}); errMigrate != nil {
		panic(errMigrate)
	}
	Db = db
}

func Close() {
	dbSql, errDb := Db.DB()

	if errDb != nil {
		panic(errDb.Error())
	}
	if errClose := dbSql.Close(); errClose != nil {
		panic(errClose.Error())
	}
}
