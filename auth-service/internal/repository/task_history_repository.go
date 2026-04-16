package repository

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
)

type TaskHistoryRepository interface {
	Create(entry *model.TaskHistory) error
	BulkCreate(entries []model.TaskHistory) error
	FindByTaskID(taskID uint) ([]model.TaskHistory, error)
}

type taskHistoryRepository struct {
	db *gorm.DB
}

func NewTaskHistoryRepository(db *gorm.DB) TaskHistoryRepository {
	return &taskHistoryRepository{db: db}
}

func (r *taskHistoryRepository) Create(entry *model.TaskHistory) error {
	return r.db.Create(entry).Error
}

func (r *taskHistoryRepository) BulkCreate(entries []model.TaskHistory) error {
	if len(entries) == 0 {
		return nil
	}
	return r.db.Create(&entries).Error
}

func (r *taskHistoryRepository) FindByTaskID(taskID uint) ([]model.TaskHistory, error) {
	var entries []model.TaskHistory
	err := r.db.Preload("User").
		Where("task_id = ?", taskID).
		Order("created_at desc").
		Find(&entries).Error
	return entries, err
}
