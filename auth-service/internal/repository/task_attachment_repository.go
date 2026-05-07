package repository

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
)

type TaskAttachmentRepository interface {
	Create(a *model.TaskAttachment) error
	FindByTaskID(taskID uint) ([]model.TaskAttachment, error)
	Delete(id, taskID uint) error
}

type taskAttachmentRepository struct {
	db *gorm.DB
}

func NewTaskAttachmentRepository(db *gorm.DB) TaskAttachmentRepository {
	return &taskAttachmentRepository{db: db}
}

func (r *taskAttachmentRepository) Create(a *model.TaskAttachment) error {
	return r.db.Create(a).Error
}

func (r *taskAttachmentRepository) FindByTaskID(taskID uint) ([]model.TaskAttachment, error) {
	var attachments []model.TaskAttachment
	err := r.db.Where("task_id = ?", taskID).Order("created_at asc").Find(&attachments).Error
	return attachments, err
}

func (r *taskAttachmentRepository) Delete(id, taskID uint) error {
	return r.db.Where("id = ? AND task_id = ?", id, taskID).Delete(&model.TaskAttachment{}).Error
}
