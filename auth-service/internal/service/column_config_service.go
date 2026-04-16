package service

import (
	"encoding/json"
	"errors"

	"auth-service/internal/model"
	"auth-service/internal/repository"
)

type ColumnConfigService interface {
	Get(projectID, actorID uint, actorRole string) (*model.ColumnConfigResponse, error)
	Update(projectID, actorID uint, actorRole string, req *model.UpdateColumnConfigRequest) (*model.ColumnConfigResponse, error)
}

type columnConfigService struct {
	colRepo     repository.ColumnConfigRepository
	projectRepo repository.ProjectRepository
	memberRepo  repository.ProjectMemberRepository
}

func NewColumnConfigService(
	colRepo repository.ColumnConfigRepository,
	projectRepo repository.ProjectRepository,
	memberRepo repository.ProjectMemberRepository,
) ColumnConfigService {
	return &columnConfigService{colRepo: colRepo, projectRepo: projectRepo, memberRepo: memberRepo}
}

func (s *columnConfigService) Get(projectID, actorID uint, actorRole string) (*model.ColumnConfigResponse, error) {
	if _, err := s.projectRepo.FindByID(projectID); err != nil {
		return nil, errors.New("project not found")
	}
	if actorRole != "admin" && !s.memberRepo.IsMember(projectID, actorID) {
		return nil, errors.New("forbidden")
	}
	cfg, err := s.colRepo.Get(projectID)
	if err != nil {
		return nil, err
	}
	return toConfigResponse(cfg)
}

func (s *columnConfigService) Update(projectID, actorID uint, actorRole string, req *model.UpdateColumnConfigRequest) (*model.ColumnConfigResponse, error) {
	if _, err := s.projectRepo.FindByID(projectID); err != nil {
		return nil, errors.New("project not found")
	}
	if actorRole != "admin" && !s.memberRepo.IsMember(projectID, actorID) {
		return nil, errors.New("forbidden")
	}

	labelsJSON, err := json.Marshal(req.Labels)
	if err != nil {
		return nil, errors.New("invalid labels format")
	}
	colsJSON, err := json.Marshal(req.CustomCols)
	if err != nil {
		return nil, errors.New("invalid custom_cols format")
	}

	cfg := &model.ProjectColumnConfig{
		ProjectID:  projectID,
		Labels:     string(labelsJSON),
		CustomCols: string(colsJSON),
	}
	if err := s.colRepo.Upsert(cfg); err != nil {
		return nil, errors.New("failed to save column config")
	}
	return toConfigResponse(cfg)
}

func toConfigResponse(cfg *model.ProjectColumnConfig) (*model.ColumnConfigResponse, error) {
	resp := &model.ColumnConfigResponse{
		Labels:     map[string]string{},
		CustomCols: []model.CustomColumn{},
	}
	if cfg.Labels != "" && cfg.Labels != "null" {
		if err := json.Unmarshal([]byte(cfg.Labels), &resp.Labels); err != nil {
			resp.Labels = map[string]string{}
		}
	}
	if cfg.CustomCols != "" && cfg.CustomCols != "null" {
		if err := json.Unmarshal([]byte(cfg.CustomCols), &resp.CustomCols); err != nil {
			resp.CustomCols = []model.CustomColumn{}
		}
	}
	return resp, nil
}
