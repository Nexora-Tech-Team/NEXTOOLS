package handler

import (
	"net/http"
	"strconv"

	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
)

type TaskAttachmentHandler struct {
	svc service.TaskAttachmentService
}

func NewTaskAttachmentHandler(svc service.TaskAttachmentService) *TaskAttachmentHandler {
	return &TaskAttachmentHandler{svc: svc}
}

// POST /api/tasks/:id/attachments
func (h *TaskAttachmentHandler) Create(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	var req struct {
		Filename string `json:"filename" binding:"required"`
		MimeType string `json:"mime_type" binding:"required"`
		Data     string `json:"data" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.svc.Create(uint(taskID), req.Filename, req.MimeType, req.Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": result})
}

// GET /api/tasks/:id/attachments
func (h *TaskAttachmentHandler) GetByTask(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	result, err := h.svc.GetByTaskID(uint(taskID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// DELETE /api/tasks/:id/attachments/:attachmentId
func (h *TaskAttachmentHandler) Delete(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	attachID, err := strconv.ParseUint(c.Param("attachmentId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid attachment id"})
		return
	}

	if err := h.svc.Delete(uint(attachID), uint(taskID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "attachment deleted"})
}
