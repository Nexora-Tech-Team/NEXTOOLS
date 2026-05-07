package repository

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
)

type TaskRepository interface {
	Create(task *model.Task) error
	FindByProjectID(projectID uint) ([]model.Task, error)
	FindByID(id uint) (*model.Task, error)
	UpdateFields(id uint, fields map[string]interface{}) error
	Delete(id uint) error
	CountByProjectID(projectID uint) (int64, error)
}

type taskRepository struct {
	db *gorm.DB
}

func NewTaskRepository(db *gorm.DB) TaskRepository {
	return &taskRepository{db: db}
}

func (r *taskRepository) Create(task *model.Task) error {
	return r.db.Create(task).Error
}

func (r *taskRepository) FindByProjectID(projectID uint) ([]model.Task, error) {
	var tasks []model.Task
	err := r.db.
		Preload("Assignee").
		Preload("Creator").
		Preload("Subtasks").
		Where("project_id = ? AND parent_task_id IS NULL", projectID).
		Order("created_at desc").
		Find(&tasks).Error
	return tasks, err
}

func (r *taskRepository) FindByID(id uint) (*model.Task, error) {
	var task model.Task
	err := r.db.Preload("Assignee").Preload("Creator").Preload("Subtasks").Preload("Subtasks.Assignee").First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *taskRepository) UpdateFields(id uint, fields map[string]interface{}) error {
	return r.db.Model(&model.Task{}).Where("id = ?", id).Updates(fields).Error
}

func (r *taskRepository) Delete(id uint) error {
	return r.db.Delete(&model.Task{}, id).Error
}

func (r *taskRepository) CountByProjectID(projectID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Task{}).Where("project_id = ?", projectID).Count(&count).Error
	return count, err
}
