package model

// ProjectColumnConfig stores kanban column customisation per project in DB.
type ProjectColumnConfig struct {
	ProjectID  uint   `gorm:"primaryKey" json:"project_id"`
	Labels     string `gorm:"type:text;default:'{}'" json:"labels"`      // JSON map[string]string
	CustomCols string `gorm:"type:text;default:'[]'" json:"custom_cols"` // JSON array of CustomColumn
}

// CustomColumn mirrors the frontend ColDef shape for custom (user-created) columns.
type CustomColumn struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Border string `json:"border"`
	Badge  string `json:"badge"`
	Dot    string `json:"dot"`
}

// ColumnConfigResponse is the shape returned to clients.
type ColumnConfigResponse struct {
	Labels     map[string]string `json:"labels"`
	CustomCols []CustomColumn    `json:"custom_cols"`
}

// UpdateColumnConfigRequest is the body accepted by PUT /projects/:id/column-config.
type UpdateColumnConfigRequest struct {
	Labels     map[string]string `json:"labels"`
	CustomCols []CustomColumn    `json:"custom_cols"`
}
