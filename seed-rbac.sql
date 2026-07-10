-- Seed System Roles
INSERT INTO "roles" ("id", "name", "description", "is_system", "created_at", "updated_at")
VALUES
  ('00000000-0000-0000-0000-000000000001', 'ADMIN', 'Full system administrator with all permissions', TRUE, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'TEAM_LEAD', 'Team leader with management permissions for their team', TRUE, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'MEMBER', 'Regular team member with task creation and update permissions', TRUE, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'OBSERVER', 'Read-only access for viewing tasks and users', TRUE, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Seed Permissions
INSERT INTO "permissions" ("id", "resource", "action", "description", "created_at", "updated_at")
VALUES
  -- User Management
  ('10000000-0000-0000-0000-000000000001', 'user', 'create', 'Create new users', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'user', 'read', 'View user profiles', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'user', 'update', 'Update user profiles (admin)', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000004', 'user', 'delete', 'Deactivate/delete users', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000005', 'user', 'manage_roles', 'Assign and revoke user roles', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000006', 'user', 'search', 'Search all users (including inactive)', NOW(), NOW()),

  -- Team Management
  ('10000000-0000-0000-0000-000000000010', 'team', 'create', 'Create new teams', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000011', 'team', 'read', 'View team details', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000012', 'team', 'update', 'Update team information', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000013', 'team', 'delete', 'Delete teams', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000014', 'team', 'assign_members', 'Assign users to teams', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000015', 'team', 'remove_members', 'Remove users from teams', NOW(), NOW()),

  -- Task Management
  ('10000000-0000-0000-0000-000000000020', 'task', 'create', 'Create new tasks', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000021', 'task', 'read', 'View tasks', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000022', 'task', 'update', 'Update task details', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000023', 'task', 'delete', 'Delete tasks', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000024', 'task', 'assign', 'Assign tasks to users', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000025', 'task', 'transition', 'Change task status (workflow transitions)', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000026', 'task', 'comment', 'Add comments to tasks', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000027', 'task', 'attach', 'Upload attachments to tasks', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000028', 'task', 'label', 'Add/remove labels on tasks', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000029', 'task', 'link', 'Create task dependencies/links', NOW(), NOW()),

  -- Role Management
  ('10000000-0000-0000-0000-000000000030', 'role', 'create', 'Create custom roles', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000031', 'role', 'read', 'View roles and permissions', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000032', 'role', 'update', 'Update role permissions', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000033', 'role', 'delete', 'Delete custom roles', NOW(), NOW()),

  -- Permission Management
  ('10000000-0000-0000-0000-000000000040', 'permission', 'create', 'Create new permissions', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000041', 'permission', 'read', 'View permissions', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000042', 'permission', 'update', 'Update permissions', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000043', 'permission', 'delete', 'Delete permissions', NOW(), NOW()),

  -- Wildcard (Admin)
  ('10000000-0000-0000-0000-000000000099', '*', '*', 'Full system access (admin wildcard)', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Assign permissions to ADMIN role (wildcard)
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000099', NOW())
ON CONFLICT DO NOTHING;

-- Assign permissions to TEAM_LEAD role
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
VALUES
  -- User permissions
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', NOW()),
  -- Team permissions
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000011', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000012', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000014', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000015', NOW()),
  -- Task permissions
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000020', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000021', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000022', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000023', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000024', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000025', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000026', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000027', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000028', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000029', NOW()),
  -- Role permissions
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000031', NOW()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000041', NOW())
ON CONFLICT DO NOTHING;

-- Assign permissions to MEMBER role
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
VALUES
  -- User permissions
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', NOW()),
  -- Team permissions
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000011', NOW()),
  -- Task permissions
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000020', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000021', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000022', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000025', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000026', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000027', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000028', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000029', NOW()),
  -- Role permissions
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000031', NOW()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000041', NOW())
ON CONFLICT DO NOTHING;

-- Assign permissions to OBSERVER role
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
VALUES
  -- User permissions
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', NOW()),
  -- Team permissions
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000011', NOW()),
  -- Task permissions
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000021', NOW()),
  -- Role permissions
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000031', NOW()),
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000041', NOW())
ON CONFLICT DO NOTHING;
