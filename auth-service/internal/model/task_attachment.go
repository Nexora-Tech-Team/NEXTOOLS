package model

import "time"

type TaskAttachment struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID    uint      `gorm:"not null;index" json:"task_id"`
	Filename  string    `gorm:"not null" json:"filename"`
	MimeType  string    `gorm:"not null" json:"mime_type"`
	Data      string    `gorm:"type:text;not null" json:"data"` // base64
	CreatedAt time.Time `json:"created_at"`
}

type TaskAttachmentResponse struct {
	ID        uint      `json:"id"`
	TaskID    uint      `json:"task_id"`
	Filename  string    `json:"filename"`
	MimeType  string    `json:"mime_type"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

func (a *TaskAttachment) ToResponse() *TaskAttachmentResponse {
	return &TaskAttachmentResponse{
		ID:        a.ID,
		TaskID:    a.TaskID,
		Filename:  a.Filename,
		MimeType:  a.MimeType,
		Data:      a.Data,
		CreatedAt: a.CreatedAt,
	}
}
