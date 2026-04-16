package service

import (
	"errors"
	"fmt"
	"time"

	"auth-service/internal/model"
	"auth-service/internal/repository"
)

type TaskService interface {
	Create(projectID, creatorID uint, req *model.CreateTaskRequest) (*model.TaskResponse, error)
	GetByProject(projectID uint) ([]*model.TaskResponse, error)
	GetByID(id uint) (*model.TaskResponse, error)
	Update(id, actorID uint, actorRole string, req *model.UpdateTaskRequest) (*model.TaskResponse, error)
	Delete(id, actorID uint, actorRole string) error
}

type taskService struct {
	taskRepo    repository.TaskRepository
	projectRepo repository.ProjectRepository
	histRepo    repository.TaskHistoryRepository
}

func NewTaskService(
	taskRepo repository.TaskRepository,
	projectRepo repository.ProjectRepository,
	histRepo repository.TaskHistoryRepository,
) TaskService {
	return &taskService{taskRepo: taskRepo, projectRepo: projectRepo, histRepo: histRepo}
}

func (s *taskService) Create(projectID, creatorID uint, req *model.CreateTaskRequest) (*model.TaskResponse, error) {
	if _, err := s.projectRepo.FindByID(projectID); err != nil {
		return nil, errors.New("project not found")
	}

	status := req.Status
	if status == "" {
		status = model.StatusBacklog
	}
	priority := req.Priority
	if priority == "" {
		priority = model.PriorityMedium
	}

	var dueDate *time.Time
	if req.DueDate != nil && *req.DueDate != "" {
		t, err := time.Parse("2006-01-02", *req.DueDate)
		if err == nil {
			dueDate = &t
		}
	}

	task := &model.Task{
		Title:       req.Title,
		Description: req.Description,
		ProjectID:   projectID,
		AssigneeID:  req.AssigneeID,
		CreatorID:   creatorID,
		Status:      status,
		Priority:    priority,
		DueDate:     dueDate,
	}
	if err := s.taskRepo.Create(task); err != nil {
		return nil, errors.New("failed to create task")
	}

	// Record creation history
	s.histRepo.Create(&model.TaskHistory{ //nolint
		TaskID: task.ID,
		UserID: creatorID,
		Action: "created",
		Field:  "",
	})

	t, _ := s.taskRepo.FindByID(task.ID)
	return t.ToResponse(), nil
}

func (s *taskService) GetByProject(projectID uint) ([]*model.TaskResponse, error) {
	if _, err := s.projectRepo.FindByID(projectID); err != nil {
		return nil, errors.New("project not found")
	}
	tasks, err := s.taskRepo.FindByProjectID(projectID)
	if err != nil {
		return nil, err
	}
	var result []*model.TaskResponse
	for i := range tasks {
		result = append(result, tasks[i].ToResponse())
	}
	return result, nil
}

func (s *taskService) GetByID(id uint) (*model.TaskResponse, error) {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("task not found")
	}
	return task.ToResponse(), nil
}

func (s *taskService) Update(id, actorID uint, actorRole string, req *model.UpdateTaskRequest) (*model.TaskResponse, error) {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("task not found")
	}

	// RBAC: non-admin can only update their own tasks
	if actorRole != "admin" {
		isCreator  := task.CreatorID == actorID
		isAssignee := task.AssigneeID != nil && *task.AssigneeID == actorID
		if !isCreator && !isAssignee {
			return nil, errors.New("forbidden: you can only update tasks you created or are assigned to")
		}
	}

	// Snapshot before update for history
	snapshot := *task

	fields := map[string]interface{}{}
	if req.Title != nil && *req.Title != "" {
		fields["title"] = *req.Title
	}
	if req.Description != nil {
		fields["description"] = *req.Description
	}
	if req.Status != "" {
		fields["status"] = req.Status
	}
	if req.Priority != "" {
		fields["priority"] = req.Priority
	}
	if req.ClearAssignee {
		fields["assignee_id"] = nil
	} else if req.AssigneeID != nil {
		fields["assignee_id"] = *req.AssigneeID
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			fields["due_date"] = nil
		} else {
			t, err := time.Parse("2006-01-02", *req.DueDate)
			if err == nil {
				fields["due_date"] = t
			}
		}
	}

	if len(fields) == 0 {
		t, _ := s.taskRepo.FindByID(id)
		return t.ToResponse(), nil
	}

	if err := s.taskRepo.UpdateFields(id, fields); err != nil {
		return nil, errors.New("failed to update task")
	}

	// Build history entries
	var entries []model.TaskHistory
	if v, ok := fields["title"]; ok {
		old, nw := snapshot.Title, fmt.Sprintf("%v", v)
		entries = append(entries, histEntry(id, actorID, "title", old, nw))
	}
	if v, ok := fields["description"]; ok {
		old, nw := snapshot.Description, fmt.Sprintf("%v", v)
		entries = append(entries, histEntry(id, actorID, "description", old, nw))
	}
	if v, ok := fields["status"]; ok {
		old, nw := string(snapshot.Status), fmt.Sprintf("%v", v)
		entries = append(entries, histEntry(id, actorID, "status", old, nw))
	}
	if v, ok := fields["priority"]; ok {
		old, nw := string(snapshot.Priority), fmt.Sprintf("%v", v)
		entries = append(entries, histEntry(id, actorID, "priority", old, nw))
	}
	if _, ok := fields["assignee_id"]; ok {
		old := "unassigned"
		if snapshot.AssigneeID != nil {
			old = fmt.Sprintf("%d", *snapshot.AssigneeID)
		}
		nw := "unassigned"
		if !req.ClearAssignee && req.AssigneeID != nil {
			nw = fmt.Sprintf("%d", *req.AssigneeID)
		}
		entries = append(entries, histEntry(id, actorID, "assignee_id", old, nw))
	}
	if _, ok := fields["due_date"]; ok {
		old := ""
		if snapshot.DueDate != nil {
			old = snapshot.DueDate.Format("2006-01-02")
		}
		nw := ""
		if req.DueDate != nil {
			nw = *req.DueDate
		}
		entries = append(entries, histEntry(id, actorID, "due_date", old, nw))
	}
	s.histRepo.BulkCreate(entries) //nolint

	t, _ := s.taskRepo.FindByID(id)
	return t.ToResponse(), nil
}

func (s *taskService) Delete(id, actorID uint, actorRole string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return errors.New("task not found")
	}
	// RBAC: non-admin can only delete their own tasks
	if actorRole != "admin" {
		isCreator  := task.CreatorID == actorID
		isAssignee := task.AssigneeID != nil && *task.AssigneeID == actorID
		if !isCreator && !isAssignee {
			return errors.New("forbidden: you can only delete tasks you created or are assigned to")
		}
	}
	return s.taskRepo.Delete(id)
}

func histEntry(taskID, userID uint, field, old, nw string) model.TaskHistory {
	return model.TaskHistory{
		TaskID:   taskID,
		UserID:   userID,
		Action:   "updated",
		Field:    field,
		OldValue: &old,
		NewValue: &nw,
	}
}
