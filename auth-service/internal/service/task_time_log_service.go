package service

import (
	"errors"
	"time"

	"auth-service/internal/model"
	"auth-service/internal/repository"
)

type TaskTimeLogService interface {
	ClockIn(taskID, userID uint, clockIn *time.Time) (*model.TaskTimeLogResponse, error)
	ClockOut(taskID, userID uint, clockOut *time.Time) (*model.TaskTimeLogResponse, error)
	CreateManual(taskID, userID uint, clockIn, clockOut time.Time) (*model.TaskTimeLogResponse, error)
	GetLogs(taskID, currentUserID uint) (*model.TaskTimeLogsResponse, error)
	DeleteLog(logID, taskID, userID uint) error
	GetByDateRange(userID uint, from, to string) ([]*model.TaskTimeLogResponse, error)
	GetAllByDateRange(from, to string) ([]*model.TaskTimeLogResponse, error)
}

type taskTimeLogService struct {
	logRepo  repository.TaskTimeLogRepository
	taskRepo repository.TaskRepository
}

func NewTaskTimeLogService(logRepo repository.TaskTimeLogRepository, taskRepo repository.TaskRepository) TaskTimeLogService {
	return &taskTimeLogService{logRepo: logRepo, taskRepo: taskRepo}
}

func (s *taskTimeLogService) ClockIn(taskID, userID uint, clockIn *time.Time) (*model.TaskTimeLogResponse, error) {
	if _, err := s.taskRepo.FindByID(taskID); err != nil {
		return nil, errors.New("task not found")
	}

	if existing, err := s.logRepo.FindActiveByUserAndTask(userID, taskID); err == nil && existing != nil {
		return nil, errors.New("you already have an active clock-in for this task")
	}

	t := time.Now()
	if clockIn != nil {
		t = *clockIn
	}

	log := &model.TaskTimeLog{
		TaskID:  taskID,
		UserID:  userID,
		ClockIn: t,
	}
	if err := s.logRepo.Create(log); err != nil {
		return nil, errors.New("failed to clock in")
	}

	logs, _ := s.logRepo.FindByTaskID(taskID)
	for i := range logs {
		if logs[i].ID == log.ID {
			return logs[i].ToResponse(), nil
		}
	}
	return log.ToResponse(), nil
}

func (s *taskTimeLogService) ClockOut(taskID, userID uint, clockOut *time.Time) (*model.TaskTimeLogResponse, error) {
	active, err := s.logRepo.FindActiveByUserAndTask(userID, taskID)
	if err != nil {
		return nil, errors.New("no active clock-in found for this task")
	}

	t := time.Now()
	if clockOut != nil {
		t = *clockOut
	}
	if !t.After(active.ClockIn) {
		return nil, errors.New("clock out time must be after clock in time")
	}

	active.ClockOut = &t
	active.Duration = int64(t.Sub(active.ClockIn).Seconds())

	if err := s.logRepo.Update(active); err != nil {
		return nil, errors.New("failed to clock out")
	}

	return active.ToResponse(), nil
}

func (s *taskTimeLogService) CreateManual(taskID, userID uint, clockIn, clockOut time.Time) (*model.TaskTimeLogResponse, error) {
	if _, err := s.taskRepo.FindByID(taskID); err != nil {
		return nil, errors.New("task not found")
	}

	log := &model.TaskTimeLog{
		TaskID:   taskID,
		UserID:   userID,
		ClockIn:  clockIn,
		ClockOut: &clockOut,
		Duration: int64(clockOut.Sub(clockIn).Seconds()),
	}
	if err := s.logRepo.Create(log); err != nil {
		return nil, errors.New("failed to create time log")
	}

	logs, _ := s.logRepo.FindByTaskID(taskID)
	for i := range logs {
		if logs[i].ID == log.ID {
			return logs[i].ToResponse(), nil
		}
	}
	return log.ToResponse(), nil
}

func (s *taskTimeLogService) GetLogs(taskID, currentUserID uint) (*model.TaskTimeLogsResponse, error) {
	if _, err := s.taskRepo.FindByID(taskID); err != nil {
		return nil, errors.New("task not found")
	}

	logs, err := s.logRepo.FindByTaskID(taskID)
	if err != nil {
		return nil, err
	}

	var total int64
	var activeLog *model.TaskTimeLogResponse
	var result []*model.TaskTimeLogResponse

	for i := range logs {
		r := logs[i].ToResponse()
		result = append(result, r)
		total += logs[i].Duration
		if logs[i].ClockOut == nil && logs[i].UserID == currentUserID {
			activeLog = r
		}
	}

	return &model.TaskTimeLogsResponse{
		Logs:          result,
		TotalDuration: total,
		ActiveLog:     activeLog,
	}, nil
}

func (s *taskTimeLogService) DeleteLog(logID, taskID, userID uint) error {
	return s.logRepo.Delete(logID, taskID, userID)
}

func (s *taskTimeLogService) GetByDateRange(userID uint, from, to string) ([]*model.TaskTimeLogResponse, error) {
	logs, err := s.logRepo.FindByUserAndDateRange(userID, from, to)
	if err != nil {
		return nil, err
	}
	var result []*model.TaskTimeLogResponse
	for i := range logs {
		result = append(result, logs[i].ToResponse())
	}
	return result, nil
}

func (s *taskTimeLogService) GetAllByDateRange(from, to string) ([]*model.TaskTimeLogResponse, error) {
	logs, err := s.logRepo.FindAllByDateRange(from, to)
	if err != nil {
		return nil, err
	}
	var result []*model.TaskTimeLogResponse
	for i := range logs {
		result = append(result, logs[i].ToResponse())
	}
	return result, nil
}
