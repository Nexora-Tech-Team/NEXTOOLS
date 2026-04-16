package service

import (
	"errors"

	"auth-service/internal/model"
	"auth-service/internal/repository"
)

type ProjectService interface {
	Create(ownerID uint, req *model.CreateProjectRequest) (*model.ProjectResponse, error)
	GetAll(actorID uint, actorRole string) ([]*model.ProjectResponse, error)
	GetByID(id, actorID uint, actorRole string) (*model.ProjectResponse, error)
	Update(id, actorID uint, actorRole string, req *model.UpdateProjectRequest) (*model.ProjectResponse, error)
	Delete(id, actorID uint, actorRole string) error
}

type projectService struct {
	projectRepo repository.ProjectRepository
	taskRepo    repository.TaskRepository
	memberRepo  repository.ProjectMemberRepository
}

func NewProjectService(
	projectRepo repository.ProjectRepository,
	taskRepo repository.TaskRepository,
	memberRepo repository.ProjectMemberRepository,
) ProjectService {
	return &projectService{projectRepo: projectRepo, taskRepo: taskRepo, memberRepo: memberRepo}
}

func (s *projectService) Create(ownerID uint, req *model.CreateProjectRequest) (*model.ProjectResponse, error) {
	project := &model.Project{
		Name:        req.Name,
		Description: req.Description,
		OwnerID:     ownerID,
	}
	if err := s.projectRepo.Create(project); err != nil {
		return nil, errors.New("failed to create project")
	}
	// Auto-add creator as owner member
	s.memberRepo.Add(&model.ProjectMember{ //nolint
		ProjectID: project.ID,
		UserID:    ownerID,
		Role:      "owner",
	})
	p, _ := s.projectRepo.FindByID(project.ID)
	members, _ := s.memberRepo.FindByProjectID(project.ID)
	return toProjectResponse(p, 0, members), nil
}

func (s *projectService) GetAll(actorID uint, actorRole string) ([]*model.ProjectResponse, error) {
	var projects []model.Project
	var err error

	if actorRole == "admin" {
		projects, err = s.projectRepo.FindAll()
	} else {
		ids, e := s.memberRepo.FindProjectIDsByUserID(actorID)
		if e != nil {
			return nil, e
		}
		projects, err = s.projectRepo.FindByIDs(ids)
	}
	if err != nil {
		return nil, err
	}

	var result []*model.ProjectResponse
	for i := range projects {
		count, _ := s.taskRepo.CountByProjectID(projects[i].ID)
		members, _ := s.memberRepo.FindByProjectID(projects[i].ID)
		result = append(result, toProjectResponse(&projects[i], int(count), members))
	}
	return result, nil
}

func (s *projectService) GetByID(id, actorID uint, actorRole string) (*model.ProjectResponse, error) {
	project, err := s.projectRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("project not found")
	}
	// Access check
	if actorRole != "admin" && !s.memberRepo.IsMember(id, actorID) {
		return nil, errors.New("forbidden: you are not a member of this project")
	}
	count, _ := s.taskRepo.CountByProjectID(id)
	members, _ := s.memberRepo.FindByProjectID(id)
	return toProjectResponse(project, int(count), members), nil
}

func (s *projectService) Update(id, actorID uint, actorRole string, req *model.UpdateProjectRequest) (*model.ProjectResponse, error) {
	project, err := s.projectRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("project not found")
	}
	// RBAC: admin or member can update
	if actorRole != "admin" && !s.memberRepo.IsMember(id, actorID) {
		return nil, errors.New("forbidden: you are not a member of this project")
	}
	if req.Name != "" {
		project.Name = req.Name
	}
	project.Description = req.Description
	if err := s.projectRepo.Update(project); err != nil {
		return nil, errors.New("failed to update project")
	}
	count, _ := s.taskRepo.CountByProjectID(id)
	members, _ := s.memberRepo.FindByProjectID(id)
	return toProjectResponse(project, int(count), members), nil
}

func (s *projectService) Delete(id, actorID uint, actorRole string) error {
	if _, err := s.projectRepo.FindByID(id); err != nil {
		return errors.New("project not found")
	}
	// Only admin or project owner can delete
	if actorRole != "admin" {
		role := s.memberRepo.GetRole(id, actorID)
		if role != "owner" {
			return errors.New("forbidden: only project owner or admin can delete this project")
		}
	}
	return s.projectRepo.Delete(id)
}

func toProjectResponse(p *model.Project, taskCount int, members []model.ProjectMember) *model.ProjectResponse {
	resp := &model.ProjectResponse{
		ID:          p.ID,
		Name:        p.Name,
		Description: p.Description,
		OwnerID:     p.OwnerID,
		TaskCount:   taskCount,
		MemberCount: len(members),
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
	if p.Owner.ID != 0 {
		resp.Owner = p.Owner.ToResponse()
	}
	for i := range members {
		resp.Members = append(resp.Members, members[i].ToResponse())
	}
	return resp
}
