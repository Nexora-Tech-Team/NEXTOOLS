package service

import (
	"auth-service/internal/model"
	"auth-service/internal/repository"
)

type TaskHistoryService interface {
	GetByTaskID(taskID uint) ([]*model.TaskHistoryResponse, error)
}

type taskHistoryService struct {
	histRepo repository.TaskHistoryRepository
}

func NewTaskHistoryService(histRepo repository.TaskHistoryRepository) TaskHistoryService {
	return &taskHistoryService{histRepo: histRepo}
}

func (s *taskHistoryService) GetByTaskID(taskID uint) ([]*model.TaskHistoryResponse, error) {
	entries, err := s.histRepo.FindByTaskID(taskID)
	if err != nil {
		return nil, err
	}
	var result []*model.TaskHistoryResponse
	for i := range entries {
		result = append(result, entries[i].ToResponse())
	}
	return result, nil
}
