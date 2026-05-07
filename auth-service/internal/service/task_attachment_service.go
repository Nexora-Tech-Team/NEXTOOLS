package service

import (
	"errors"

	"auth-service/internal/model"
	"auth-service/internal/repository"
)

type TaskAttachmentService interface {
	Create(taskID uint, filename, mimeType, data string) (*model.TaskAttachmentResponse, error)
	GetByTaskID(taskID uint) ([]*model.TaskAttachmentResponse, error)
	Delete(id, taskID uint) error
}

type taskAttachmentService struct {
	repo     repository.TaskAttachmentRepository
	taskRepo repository.TaskRepository
}

func NewTaskAttachmentService(repo repository.TaskAttachmentRepository, taskRepo repository.TaskRepository) TaskAttachmentService {
	return &taskAttachmentService{repo: repo, taskRepo: taskRepo}
}

func (s *taskAttachmentService) Create(taskID uint, filename, mimeType, data string) (*model.TaskAttachmentResponse, error) {
	if _, err := s.taskRepo.FindByID(taskID); err != nil {
		return nil, errors.New("task not found")
	}
	a := &model.TaskAttachment{
		TaskID:   taskID,
		Filename: filename,
		MimeType: mimeType,
		Data:     data,
	}
	if err := s.repo.Create(a); err != nil {
		return nil, errors.New("failed to save attachment")
	}
	return a.ToResponse(), nil
}

func (s *taskAttachmentService) GetByTaskID(taskID uint) ([]*model.TaskAttachmentResponse, error) {
	attachments, err := s.repo.FindByTaskID(taskID)
	if err != nil {
		return nil, err
	}
	var result []*model.TaskAttachmentResponse
	for i := range attachments {
		result = append(result, attachments[i].ToResponse())
	}
	return result, nil
}

func (s *taskAttachmentService) Delete(id, taskID uint) error {
	return s.repo.Delete(id, taskID)
}
