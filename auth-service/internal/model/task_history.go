package model

import "time"

type TaskHistory struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID    uint      `gorm:"not null;index" json:"task_id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Action    string    `gorm:"type:varchar(20);not null" json:"action"` // created | updated
	Field     string    `gorm:"type:varchar(50);not null" json:"field"`  // "" for created
	OldValue  *string   `gorm:"type:text" json:"old_value"`
	NewValue  *string   `gorm:"type:text" json:"new_value"`
	CreatedAt time.Time `json:"created_at"`
}

type TaskHistoryResponse struct {
	ID        uint          `json:"id"`
	TaskID    uint          `json:"task_id"`
	Action    string        `json:"action"`
	Field     string        `json:"field"`
	OldValue  *string       `json:"old_value"`
	NewValue  *string       `json:"new_value"`
	ChangedBy *UserResponse `json:"changed_by,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
}

func (h *TaskHistory) ToResponse() *TaskHistoryResponse {
	r := &TaskHistoryResponse{
		ID:        h.ID,
		TaskID:    h.TaskID,
		Action:    h.Action,
		Field:     h.Field,
		OldValue:  h.OldValue,
		NewValue:  h.NewValue,
		CreatedAt: h.CreatedAt,
	}
	if h.User.ID != 0 {
		r.ChangedBy = h.User.ToResponse()
	}
	return r
}
