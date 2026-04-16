package service

import (
	"errors"

	"auth-service/internal/model"
	"auth-service/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

type UserService interface {
	GetAll() ([]*model.UserResponse, error)
	GetByID(id uint) (*model.UserResponse, error)
	Update(id uint, req *model.UpdateUserRequest) (*model.UserResponse, error)
	Delete(id uint) error
}

type userService struct {
	userRepo repository.UserRepository
}

func NewUserService(userRepo repository.UserRepository) UserService {
	return &userService{userRepo: userRepo}
}

func (s *userService) GetAll() ([]*model.UserResponse, error) {
	users, err := s.userRepo.FindAll()
	if err != nil {
		return nil, err
	}

	var responses []*model.UserResponse
	for i := range users {
		responses = append(responses, users[i].ToResponse())
	}
	return responses, nil
}

func (s *userService) GetByID(id uint) (*model.UserResponse, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("user not found")
	}
	return user.ToResponse(), nil
}

func (s *userService) Update(id uint, req *model.UpdateUserRequest) (*model.UserResponse, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, errors.New("failed to hash password")
		}
		user.Password = string(hashed)
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, errors.New("failed to update user")
	}

	return user.ToResponse(), nil
}

func (s *userService) Delete(id uint) error {
	_, err := s.userRepo.FindByID(id)
	if err != nil {
		return errors.New("user not found")
	}
	return s.userRepo.Delete(id)
}
