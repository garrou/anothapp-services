package utils

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt"
	"golang.org/x/crypto/bcrypt"
)

type jwtClaims struct {
	UserId string `json:"id"`
	jwt.StandardClaims
}

func GenerateToken(userId string) string {
	claims := &jwtClaims{
		userId,
		jwt.StandardClaims{
			IssuedAt:  time.Now().Unix(),
			ExpiresAt: time.Now().AddDate(1, 0, 0).Unix(),
			Issuer:    os.Getenv("JWT_ISSUER"),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	if err != nil {
		panic(err.Error())
	}
	return t
}

func HashPassword(password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	if err != nil {
		log.Println("Failed to hash password")
	}
	return string(hash)
}

func ComparePassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func ValidateToken(token string) (*jwt.Token, error) {
	return jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
}

func ExtractUserId(token *jwt.Token) string {
	claims := token.Claims.(jwt.MapClaims)
	return fmt.Sprintf("%s", claims["id"])
}
