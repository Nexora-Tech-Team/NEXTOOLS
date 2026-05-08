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
	SetAssignees(taskID uint, userIDs []uint) error
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
		Preload("Assignees").
		Preload("Creator").
		Preload("Subtasks").
		Preload("Subtasks.Assignees").
		Where("project_id = ? AND parent_task_id IS NULL", projectID).
		Order("created_at desc").
		Find(&tasks).Error
	return tasks, err
}

func (r *taskRepository) FindByID(id uint) (*model.Task, error) {
	var task model.Task
	err := r.db.Preload("Assignee").Preload("Assignees").Preload("Creator").Preload("Subtasks").Preload("Subtasks.Assignee").First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *taskRepository) SetAssignees(taskID uint, userIDs []uint) error {
	task := &model.Task{ID: taskID}
	users := make([]*model.User, len(userIDs))
	for i, id := range userIDs {
		uid := id
		users[i] = &model.User{ID: uid}
	}
	return r.db.Model(task).Association("Assignees").Replace(users)
}

func (r *taskRepository) UpdateFields(id uint, fields map[string]interface{}) error {
	return r.db.Model(&model.Task{}).Where("id = ?", id).Updates(fields).Error
}

func (r *taskRepository) Delete(id uint) error {
	// Clean up related records first (no CASCADE in DB)
	r.db.Where("task_id = ?", id).Delete(&model.TaskTimeLog{})
	r.db.Where("task_id = ?", id).Delete(&model.TaskHistory{})
	r.db.Where("task_id = ?", id).Delete(&model.TaskAttachment{})
	r.db.Exec("DELETE FROM task_assignees WHERE task_id = ?", id)
	return r.db.Delete(&model.Task{}, id).Error
}

func (r *taskRepository) CountByProjectID(projectID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Task{}).Where("project_id = ?", projectID).Count(&count).Error
	return count, err
}
