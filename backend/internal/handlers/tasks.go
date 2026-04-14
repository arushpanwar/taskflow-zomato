package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/arushpanwar/taskflow/internal/middleware"
	"github.com/arushpanwar/taskflow/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type createTaskRequest struct {
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Priority    string     `json:"priority"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`
	DueDate     *string    `json:"due_date"`
}

type updateTaskRequest struct {
	Title       *string         `json:"title"`
	Description *string         `json:"description"`
	Status      *string         `json:"status"`
	Priority    *string         `json:"priority"`
	// RawMessage lets us distinguish {"assignee_id": null} (clear) from field absent (keep)
	AssigneeID  json.RawMessage `json:"assignee_id"`
	DueDate     *string         `json:"due_date"`
}

// parseAssigneeID returns (provided, *uuid.UUID, error).
func (r *updateTaskRequest) parseAssigneeID() (bool, *uuid.UUID, error) {
	if len(r.AssigneeID) == 0 {
		return false, nil, nil
	}
	if string(r.AssigneeID) == "null" {
		return true, nil, nil
	}
	var id uuid.UUID
	if err := json.Unmarshal(r.AssigneeID, &id); err != nil {
		return true, nil, err
	}
	return true, &id, nil
}

var validStatuses = map[string]bool{"todo": true, "in_progress": true, "done": true}
var validPriorities = map[string]bool{"low": true, "medium": true, "high": true}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	// Verify access to project
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

	// Build filtered query
	query := `SELECT id, title, description, status, priority, project_id, assignee_id, created_by, due_date, created_at, updated_at
	          FROM tasks WHERE project_id = $1`
	args := []any{projectID}
	idx := 2

	if status := r.URL.Query().Get("status"); status != "" && validStatuses[status] {
		query += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, status)
		idx++
	}
	if assignee := r.URL.Query().Get("assignee"); assignee != "" {
		if assigneeID, err := uuid.Parse(assignee); err == nil {
			query += fmt.Sprintf(" AND assignee_id = $%d", idx)
			args = append(args, assigneeID)
		}
	}
	query += " ORDER BY created_at ASC"

	rows, err := h.db.Query(r.Context(), query, args...)
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

	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	// Verify project exists and user has access (owner or assignee in project)
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

	var req createTaskRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fields := map[string]string{}
	if strings.TrimSpace(req.Title) == "" {
		fields["title"] = "is required"
	}
	if req.Priority != "" && !validPriorities[req.Priority] {
		fields["priority"] = "must be low, medium, or high"
	}
	if len(fields) > 0 {
		writeValidationError(w, fields)
		return
	}

	if req.Priority == "" {
		req.Priority = "medium"
	}

	var t models.Task
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO tasks (title, description, priority, project_id, assignee_id, created_by, due_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, title, description, status, priority, project_id, assignee_id, created_by, due_date, created_at, updated_at`,
		strings.TrimSpace(req.Title), req.Description, req.Priority, projectID, req.AssigneeID, userID, req.DueDate,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.CreatedBy, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusCreated, t)
}

func (h *Handler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	// Load task + project owner
	var t models.Task
	var ownerID uuid.UUID
	err = h.db.QueryRow(r.Context(),
		`SELECT t.id, t.project_id, t.created_by, p.owner_id
		 FROM tasks t JOIN projects p ON p.id = t.project_id
		 WHERE t.id = $1`, taskID,
	).Scan(&t.ID, &t.ProjectID, &t.CreatedBy, &ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	// Any project member can update tasks
	if ownerID != userID {
		var exists bool
		h.db.QueryRow(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM tasks WHERE project_id = $1 AND assignee_id = $2)`,
			t.ProjectID, userID,
		).Scan(&exists)
		if !exists {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	var req updateTaskRequest
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Status != nil && !validStatuses[*req.Status] {
		writeValidationError(w, map[string]string{"status": "must be todo, in_progress, or done"})
		return
	}
	if req.Priority != nil && !validPriorities[*req.Priority] {
		writeValidationError(w, map[string]string{"priority": "must be low, medium, or high"})
		return
	}

	assigneeProvided, assigneeID, err := req.parseAssigneeID()
	if err != nil {
		writeValidationError(w, map[string]string{"assignee_id": "must be a valid UUID or null"})
		return
	}

	var updated models.Task
	err = h.db.QueryRow(r.Context(),
		`UPDATE tasks SET
			title       = COALESCE($1, title),
			description = COALESCE($2, description),
			status      = COALESCE($3::task_status, status),
			priority    = COALESCE($4::task_priority, priority),
			assignee_id = CASE WHEN $5::boolean THEN $6 ELSE assignee_id END,
			due_date    = COALESCE($7::date, due_date),
			updated_at  = NOW()
		 WHERE id = $8
		 RETURNING id, title, description, status, priority, project_id, assignee_id, created_by, due_date, created_at, updated_at`,
		req.Title, req.Description, req.Status, req.Priority,
		assigneeProvided, assigneeID,
		req.DueDate, taskID,
	).Scan(&updated.ID, &updated.Title, &updated.Description, &updated.Status, &updated.Priority,
		&updated.ProjectID, &updated.AssigneeID, &updated.CreatedBy, &updated.DueDate, &updated.CreatedAt, &updated.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	var createdBy, ownerID uuid.UUID
	err = h.db.QueryRow(r.Context(),
		`SELECT t.created_by, p.owner_id
		 FROM tasks t JOIN projects p ON p.id = t.project_id
		 WHERE t.id = $1`, taskID,
	).Scan(&createdBy, &ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	if ownerID != userID && createdBy != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	if _, err := h.db.Exec(r.Context(), `DELETE FROM tasks WHERE id = $1`, taskID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
