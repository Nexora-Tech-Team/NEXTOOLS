package handler

import (
	"net/http"
	"strconv"

	"auth-service/internal/model"
	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
)

type ColumnConfigHandler struct {
	svc service.ColumnConfigService
}

func NewColumnConfigHandler(svc service.ColumnConfigService) *ColumnConfigHandler {
	return &ColumnConfigHandler{svc: svc}
}

// GET /api/projects/:id/column-config
func (h *ColumnConfigHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	actorID := c.GetUint("user_id")
	actorRole := c.GetString("role")
	cfg, err := h.svc.Get(uint(id), actorID, actorRole)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "project not found" {
			status = http.StatusNotFound
		} else if err.Error() == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": cfg})
}

// PUT /api/projects/:id/column-config
func (h *ColumnConfigHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	actorID := c.GetUint("user_id")
	actorRole := c.GetString("role")
	var req model.UpdateColumnConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	cfg, err := h.svc.Update(uint(id), actorID, actorRole, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "project not found" {
			status = http.StatusNotFound
		} else if err.Error() == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "column config updated", "data": cfg})
}
