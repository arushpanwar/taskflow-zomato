-- Seed data for TaskFlow
-- Password for test@example.com is: password123
-- bcrypt hash generated with cost 12

INSERT INTO users (id, name, email, password) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Test User', 'test@example.com', '$2y$12$Nqd2GErSrtLrPTsoHyZ1LeYGpRrT64WRCA5chniKb.Kjo8ysk8hfu'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Alice Smith', 'alice@example.com', '$2y$12$Nqd2GErSrtLrPTsoHyZ1LeYGpRrT64WRCA5chniKb.Kjo8ysk8hfu')
ON CONFLICT (email) DO NOTHING;

INSERT INTO projects (id, name, description, owner_id) VALUES
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Website Redesign', 'Q2 marketing site overhaul', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id, created_by, due_date) VALUES
  (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    'Design homepage wireframes',
    'Create low-fidelity wireframes for the new homepage layout',
    'done',
    'high',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '2026-04-10'
  ),
  (
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    'Implement responsive navigation',
    'Build the mobile-first nav component using the approved designs',
    'in_progress',
    'high',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '2026-04-20'
  ),
  (
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
    'Write copy for hero section',
    'Draft headline and subheadline variants for A/B testing',
    'todo',
    'medium',
    'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    NULL,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '2026-04-25'
  )
ON CONFLICT DO NOTHING;
