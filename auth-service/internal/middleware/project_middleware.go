package middleware

import (
	"net/http"
	"strconv"

	"auth-service/internal/repository"

	"github.com/gin-gonic/gin"
)

// ProjectMemberOnly allows admins through freely; for regular users it checks
// that the caller is a member of the project identified by the :id URL param.
func ProjectMemberOnly(memberRepo repository.ProjectMemberRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role == "admin" {
			c.Next()
			return
		}
		userID := c.GetUint("user_id")
		projectID, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil || !memberRepo.IsMember(uint(projectID), userID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: you are not a member of this project"})
			c.Abort()
			return
		}
		c.Next()
	}
}
