package handler

import (
	"net/http"
	"strconv"

	"auth-service/internal/model"
	"auth-service/internal/service"

	"github.com/gin-gonic/gin"
)

type ProjectMemberHandler struct {
	memberService service.ProjectMemberService
}

func NewProjectMemberHandler(memberService service.ProjectMemberService) *ProjectMemberHandler {
	return &ProjectMemberHandler{memberService: memberService}
}

// GET /api/projects/:id/members
func (h *ProjectMemberHandler) GetMembers(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	members, err := h.memberService.GetMembers(uint(projectID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": members, "total": len(members)})
}

// POST /api/projects/:id/members
func (h *ProjectMemberHandler) AddMember(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")

	var req model.AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.memberService.AddMember(uint(projectID), actorID, req.UserID, actorRole); err != nil {
		status := http.StatusBadRequest
		if err.Error()[:9] == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "member added"})
}

// DELETE /api/projects/:id/members/:userID
func (h *ProjectMemberHandler) RemoveMember(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	targetUserID, err := strconv.ParseUint(c.Param("userID"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	actorID   := c.GetUint("user_id")
	actorRole := c.GetString("role")

	if err := h.memberService.RemoveMember(uint(projectID), actorID, uint(targetUserID), actorRole); err != nil {
		status := http.StatusBadRequest
		if len(err.Error()) >= 9 && err.Error()[:9] == "forbidden" {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}
