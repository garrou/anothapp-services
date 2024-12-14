package models

type UserDto struct {
	Email    string
	Username string
}

type UserLoginDto struct {
	Identifier string `json:"identifier" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

type UserSignUpDto struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	Username string `json:"username" binding:"required,max=50"`
	Password string `json:"password" binding:"required,min=8,max=50"`
	Confirm  string `json:"confirm" binding:"required,min=8,max=50,eqfield=Password"`
}
