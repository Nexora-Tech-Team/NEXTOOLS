package service

import (
	"errors"

	"auth-service/internal/model"
	"auth-service/internal/repository"
)

type ProjectMemberService interface {
	GetMembers(projectID uint) ([]*model.ProjectMemberResponse, error)
	AddMember(projectID, actorID, targetUserID uint, actorRole string) error
	RemoveMember(projectID, actorID, targetUserID uint, actorRole string) error
}

type projectMemberService struct {
	memberRepo  repository.ProjectMemberRepository
	projectRepo repository.ProjectRepository
	userRepo    repository.UserRepository
}

func NewProjectMemberService(
	memberRepo repository.ProjectMemberRepository,
	projectRepo repository.ProjectRepository,
	userRepo repository.UserRepository,
) ProjectMemberService {
	return &projectMemberService{
		memberRepo:  memberRepo,
		projectRepo: projectRepo,
		userRepo:    userRepo,
	}
}

func (s *projectMemberService) GetMembers(projectID uint) ([]*model.ProjectMemberResponse, error) {
	members, err := s.memberRepo.FindByProjectID(projectID)
	if err != nil {
		return nil, err
	}
	var result []*model.ProjectMemberResponse
	for i := range members {
		result = append(result, members[i].ToResponse())
	}
	return result, nil
}

func (s *projectMemberService) AddMember(projectID, actorID, targetUserID uint, actorRole string) error {
	// Only admin or project owner can add members
	if actorRole != "admin" {
		role := s.memberRepo.GetRole(projectID, actorID)
		if role != "owner" {
			return errors.New("only project owner or admin can add members")
		}
	}
	// Check project exists
	if _, err := s.projectRepo.FindByID(projectID); err != nil {
		return errors.New("project not found")
	}
	// Check user exists
	if _, err := s.userRepo.FindByID(targetUserID); err != nil {
		return errors.New("user not found")
	}
	// Already a member?
	if s.memberRepo.IsMember(projectID, targetUserID) {
		return errors.New("user is already a member")
	}
	return s.memberRepo.Add(&model.ProjectMember{
		ProjectID: projectID,
		UserID:    targetUserID,
		Role:      "member",
	})
}

func (s *projectMemberService) RemoveMember(projectID, actorID, targetUserID uint, actorRole string) error {
	// Only admin or project owner can remove members
	if actorRole != "admin" {
		role := s.memberRepo.GetRole(projectID, actorID)
		if role != "owner" {
			return errors.New("only project owner or admin can remove members")
		}
	}
	// Cannot remove the owner
	targetRole := s.memberRepo.GetRole(projectID, targetUserID)
	if targetRole == "owner" {
		return errors.New("cannot remove project owner")
	}
	return s.memberRepo.Remove(projectID, targetUserID)
}
