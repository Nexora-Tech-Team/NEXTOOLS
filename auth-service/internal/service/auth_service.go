package service

import (
	"errors"
	"os"
	"time"

	"auth-service/internal/model"
	"auth-service/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService interface {
	Register(req *model.RegisterRequest) (*model.UserResponse, error)
	Login(req *model.LoginRequest) (*model.LoginResponse, error)
}

type authService struct {
	userRepo repository.UserRepository
}

func NewAuthService(userRepo repository.UserRepository) AuthService {
	return &authService{userRepo: userRepo}
}

func (s *authService) Register(req *model.RegisterRequest) (*model.UserResponse, error) {
	// Check if email already exists
	existing, err := s.userRepo.FindByEmail(req.Email)
	if err == nil && existing != nil {
		return nil, errors.New("email already registered")
	}

	// Set default role
	role := req.Role
	if role == "" {
		role = model.RoleUser
	}

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	user := &model.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashed),
		Role:     role,
		IsActive: true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, errors.New("failed to create user")
	}

	return user.ToResponse(), nil
}

func (s *authService) Login(req *model.LoginRequest) (*model.LoginResponse, error) {
	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid email or password")
		}
		return nil, err
	}

	if !user.IsActive {
		return nil, errors.New("account is deactivated")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	token, err := generateJWT(user)
	if err != nil {
		return nil, errors.New("failed to generate token")
	}

	return &model.LoginResponse{
		Token: token,
		User:  user.ToResponse(),
	}, nil
}

func generateJWT(user *model.User) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
