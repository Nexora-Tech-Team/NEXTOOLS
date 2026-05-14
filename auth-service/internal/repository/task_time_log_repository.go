package repository

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
)

type TaskTimeLogRepository interface {
	Create(log *model.TaskTimeLog) error
	FindByTaskID(taskID uint) ([]model.TaskTimeLog, error)
	FindActiveByUserAndTask(userID, taskID uint) (*model.TaskTimeLog, error)
	FindActiveByUser(userID uint) (*model.TaskTimeLog, error)
	FindActiveByProject(projectID uint) ([]model.TaskTimeLog, error)
	Update(log *model.TaskTimeLog) error
	Delete(logID, taskID, userID uint) error
	FindByUserAndDateRange(userID uint, from, to string) ([]model.TaskTimeLog, error)
	FindAllByDateRange(from, to string) ([]model.TaskTimeLog, error)
}

type taskTimeLogRepository struct {
	db *gorm.DB
}

func NewTaskTimeLogRepository(db *gorm.DB) TaskTimeLogRepository {
	return &taskTimeLogRepository{db: db}
}

func (r *taskTimeLogRepository) Create(log *model.TaskTimeLog) error {
	return r.db.Create(log).Error
}

func (r *taskTimeLogRepository) FindByTaskID(taskID uint) ([]model.TaskTimeLog, error) {
	var logs []model.TaskTimeLog
	err := r.db.Preload("User").
		Where("task_id = ?", taskID).
		Order("clock_in desc").
		Find(&logs).Error
	return logs, err
}

func (r *taskTimeLogRepository) FindActiveByUserAndTask(userID, taskID uint) (*model.TaskTimeLog, error) {
	var log model.TaskTimeLog
	err := r.db.Preload("User").
		Where("task_id = ? AND user_id = ? AND clock_out IS NULL", taskID, userID).
		First(&log).Error
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *taskTimeLogRepository) FindActiveByUser(userID uint) (*model.TaskTimeLog, error) {
	var log model.TaskTimeLog
	err := r.db.Preload("User").
		Where("user_id = ? AND clock_out IS NULL", userID).
		First(&log).Error
	if err != nil {
		return nil, err
	}
	var ex taskExtra
	r.db.Raw(`
		SELECT t.title as task_title, t.project_id, p.name as project_name,
		       t.category as task_category, t.priority as task_priority, t.status as task_status
		FROM tasks t
		LEFT JOIN projects p ON p.id = t.project_id
		WHERE t.id = ?
	`, log.TaskID).Scan(&ex)
	log.TaskTitle   = ex.TaskTitle
	log.ProjectID   = ex.ProjectID
	log.ProjectName = ex.ProjectName
	return &log, nil
}

func (r *taskTimeLogRepository) FindActiveByProject(projectID uint) ([]model.TaskTimeLog, error) {
	var logs []model.TaskTimeLog
	err := r.db.Preload("User").
		Joins("JOIN tasks t ON t.id = task_time_logs.task_id").
		Where("t.project_id = ? AND task_time_logs.clock_out IS NULL", projectID).
		Find(&logs).Error
	if err != nil {
		return nil, err
	}
	r.enrichLogs(logs)
	return logs, nil
}

func (r *taskTimeLogRepository) Update(log *model.TaskTimeLog) error {
	return r.db.Save(log).Error
}

func (r *taskTimeLogRepository) Delete(logID, taskID, userID uint) error {
	return r.db.Where("id = ? AND task_id = ? AND user_id = ?", logID, taskID, userID).Delete(&model.TaskTimeLog{}).Error
}

type taskExtra struct {
	TaskTitle    string `gorm:"column:task_title"`
	ProjectID    uint   `gorm:"column:project_id"`
	ProjectName  string `gorm:"column:project_name"`
	TaskCategory string `gorm:"column:task_category"`
	TaskPriority string `gorm:"column:task_priority"`
	TaskStatus   string `gorm:"column:task_status"`
}

func (r *taskTimeLogRepository) enrichLogs(logs []model.TaskTimeLog) {
	for i := range logs {
		var ex taskExtra
		r.db.Raw(`
			SELECT t.title as task_title, t.project_id, p.name as project_name,
			       t.category as task_category, t.priority as task_priority, t.status as task_status
			FROM tasks t
			LEFT JOIN projects p ON p.id = t.project_id
			WHERE t.id = ?
		`, logs[i].TaskID).Scan(&ex)
		logs[i].TaskTitle    = ex.TaskTitle
		logs[i].ProjectID    = ex.ProjectID
		logs[i].ProjectName  = ex.ProjectName
		logs[i].TaskCategory = ex.TaskCategory
		logs[i].TaskPriority = ex.TaskPriority
		logs[i].TaskStatus   = ex.TaskStatus
	}
}

func (r *taskTimeLogRepository) FindAllByDateRange(from, to string) ([]model.TaskTimeLog, error) {
	var logs []model.TaskTimeLog
	err := r.db.
		Preload("User").
		Where("clock_in >= ? AND clock_in < (?::date + interval '1 day')", from, to).
		Order("clock_in asc").
		Find(&logs).Error
	if err != nil {
		return nil, err
	}
	r.enrichLogs(logs)
	return logs, nil
}

func (r *taskTimeLogRepository) FindByUserAndDateRange(userID uint, from, to string) ([]model.TaskTimeLog, error) {
	var logs []model.TaskTimeLog
	err := r.db.
		Preload("User").
		Where("user_id = ? AND clock_in >= ? AND clock_in < (?::date + interval '1 day')", userID, from, to).
		Order("clock_in asc").
		Find(&logs).Error
	if err != nil {
		return nil, err
	}
	r.enrichLogs(logs)
	return logs, nil
}
