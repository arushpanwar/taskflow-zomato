package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/arushpanwar/taskflow/internal/middleware"
	"github.com/arushpanwar/taskflow/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type createProjectRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

type updateProjectRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.db.Query(r.Context(), `
		SELECT DISTINCT p.id, p.name, p.description, p.owner_id, p.created_at
		FROM projects p
		LEFT JOIN tasks t ON t.project_id = p.id
		WHERE p.owner_id = $1 OR t.assignee_id = $1
		ORDER BY p.created_at DESC`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	defer rows.Close()

	projects := make([]models.Project, 0)
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "internal server error")
			return
		}
		projects = append(projects, p)
	}

	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req createProjectRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		writeValidationError(w, map[string]string{"name": "is required"})
		return
	}

	var p models.Project
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3)
		 RETURNING id, name, description, owner_id, created_at`,
		strings.TrimSpace(req.Name), req.Description, userID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusCreated, p)
}

func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	var p models.Project
	err = h.db.QueryRow(r.Context(),
		`SELECT id, name, description, owner_id, created_at FROM projects WHERE id = $1`,
		projectID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	// Access check: owner or has tasks assigned
	if p.OwnerID != userID {
		var exists bool
		h.db.QueryRow(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM tasks WHERE project_id = $1 AND assignee_id = $2)`,
			projectID, userID,
		).Scan(&exists)
		if !exists {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, title, description, status, priority, project_id, assignee_id, created_by, due_date, created_at, updated_at
		 FROM tasks WHERE project_id = $1 ORDER BY created_at ASC`, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	defer rows.Close()

	tasks := make([]models.Task, 0)
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.CreatedBy, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "internal server error")
			return
		}
		tasks = append(tasks, t)
	}

	writeJSON(w, http.StatusOK, models.ProjectWithTasks{Project: p, Tasks: tasks})
}

func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	var ownerID uuid.UUID
	err = h.db.QueryRow(r.Context(), `SELECT owner_id FROM projects WHERE id = $1`, projectID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	var req updateProjectRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var p models.Project
	err = h.db.QueryRow(r.Context(),
		`UPDATE projects
		 SET name        = COALESCE($1, name),
		     description = COALESCE($2, description)
		 WHERE id = $3
		 RETURNING id, name, description, owner_id, created_at`,
		req.Name, req.Description, projectID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, p)
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	var ownerID uuid.UUID
	err = h.db.QueryRow(r.Context(), `SELECT owner_id FROM projects WHERE id = $1`, projectID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	if _, err := h.db.Exec(r.Context(), `DELETE FROM projects WHERE id = $1`, projectID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetProjectStats(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	// Check access
	var ownerID uuid.UUID
	err = h.db.QueryRow(r.Context(), `SELECT owner_id FROM projects WHERE id = $1`, projectID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if ownerID != userID {
		var exists bool
		h.db.QueryRow(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM tasks WHERE project_id = $1 AND assignee_id = $2)`,
			projectID, userID,
		).Scan(&exists)
		if !exists {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	// Counts by status
	rows, err := h.db.Query(r.Context(),
		`SELECT status, COUNT(*) FROM tasks WHERE project_id = $1 GROUP BY status`, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	defer rows.Close()

	byStatus := map[string]int{"todo": 0, "in_progress": 0, "done": 0}
	total := 0
	for rows.Next() {
		var status string
		var count int
		rows.Scan(&status, &count)
		byStatus[status] = count
		total += count
	}

	// Counts by assignee
	rows2, err := h.db.Query(r.Context(),
		`SELECT COALESCE(u.name, 'Unassigned'), COUNT(t.id)
		 FROM tasks t
		 LEFT JOIN users u ON u.id = t.assignee_id
		 WHERE t.project_id = $1
		 GROUP BY u.name`, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	defer rows2.Close()

	byAssignee := map[string]int{}
	for rows2.Next() {
		var name string
		var count int
		rows2.Scan(&name, &count)
		byAssignee[name] = count
	}

	writeJSON(w, http.StatusOK, models.TaskStats{
		Total:      total,
		ByStatus:   byStatus,
		ByAssignee: byAssignee,
	})
}
