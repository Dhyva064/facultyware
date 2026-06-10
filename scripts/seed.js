/**
 * scripts/seed.js
 */

require('dotenv').config();
const db = require('../lib/db');
const bcrypt = require('bcryptjs');

function log(msg)  { console.log(`\n[SEED] ${msg}`); }
function ok(msg)   { console.log(`  ✓  ${msg}`); }
function skip(msg) { console.log(`  –  ${msg} (sudah ada, dilewati)`); }
function warn(msg) { console.log(`  ⚠  ${msg}`); }

// ─── 1. ROLES ─────────────────────────────────────────────────────────────────
async function seedRoles() {
  log('Seeding roles...');
  const roles = [
    { id: 1, name: 'pengguna',        guard_name: 'web' },
    { id: 2, name: 'penanggung_jawab', guard_name: 'web' },
    { id: 3, name: 'pengelola_aset',   guard_name: 'web' },
  ];
  for (const role of roles) {
    const [rows] = await db.query('SELECT id FROM roles WHERE name = ?', [role.name]);
    if (rows.length === 0) {
      await db.query(
        'INSERT INTO roles (id, name, guard_name, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [role.id, role.name, role.guard_name]
      );
      ok(`Role "${role.name}" dibuat`);
    } else {
      skip(`Role "${role.name}"`);
    }
  }
}

// ─── 2. PERMISSIONS ───────────────────────────────────────────
async function seedPermissions() {
  log('Seeding permissions...');
  const permissions = [
    'laporan.create', 'laporan.view_own', 'laporan.view_all',
    'laporan.update', 'laporan.delete',
    'maintenance.create', 'maintenance.view', 'maintenance.update',
    'maintenance.close', 'maintenance.revisi',
    'progres.create', 'progres.view', 'progres.update',
    'dashboard.view', 'pdf.download',
  ];
  for (const name of permissions) {
    const [rows] = await db.query('SELECT id FROM permissions WHERE name = ?', [name]);
    if (rows.length === 0) {
      await db.query(
        'INSERT INTO permissions (name, guard_name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [name, 'web']
      );
      ok(`Permission "${name}" dibuat`);
    } else {
      skip(`Permission "${name}"`);
    }
  }
}

// ─── 3. ROLE_HAS_PERMISSIONS ──────────────────────────────────
async function seedRolePermissions() {
  log('Seeding role_has_permissions...');
  const map = {
    pengguna:         ['laporan.create', 'laporan.view_own', 'pdf.download'],
    penanggung_jawab: ['laporan.view_all', 'laporan.update', 'laporan.delete',
                       'maintenance.create', 'maintenance.view', 'maintenance.update',
                       'maintenance.close', 'maintenance.revisi', 'dashboard.view', 'pdf.download'],
    pengelola_aset:   ['maintenance.view', 'progres.create', 'progres.view',
                       'progres.update', 'pdf.download'],
  };
  for (const [roleName, permNames] of Object.entries(map)) {
    const [[role]] = await db.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    if (!role) { warn(`Role "${roleName}" tidak ditemukan`); continue; }
    for (const permName of permNames) {
      const [[perm]] = await db.query('SELECT id FROM permissions WHERE name = ?', [permName]);
      if (!perm) { warn(`Permission "${permName}" tidak ditemukan`); continue; }
      const [ex] = await db.query(
        'SELECT 1 FROM role_has_permissions WHERE role_id = ? AND permission_id = ?',
        [role.id, perm.id]
      );
      if (ex.length === 0) {
        await db.query('INSERT INTO role_has_permissions (role_id, permission_id) VALUES (?, ?)', [role.id, perm.id]);
        ok(`${roleName} → ${permName}`);
      } else {
        skip(`${roleName} → ${permName}`);
      }
    }
  }
}

// ─── 4. EMPLOYMENT STATUSES ───────────────────────────────────────────────────
async function seedEmploymentStatuses() {
  log('Seeding employment_statuses...');
  for (const name of ['Dosen Tetap', 'Tenaga Kependidikan', 'Honorer']) {
    const [rows] = await db.query('SELECT id FROM employment_statuses WHERE name = ?', [name]);
    if (rows.length === 0) {
      await db.query('INSERT INTO employment_statuses (name, created_at, updated_at) VALUES (?, NOW(), NOW())', [name]);
      ok(`Employment status "${name}" dibuat`);
    } else {
      skip(`Employment status "${name}"`);
    }
  }
}

// ─── 5. ORGANIZATION UNITS ────────────────────────────────────────────────────
async function seedOrganizationUnits() {
  log('Seeding organization_units...');

  // Nonaktifkan FK sementara agar bisa insert self-reference
  await db.query('SET FOREIGN_KEY_CHECKS = 0');

  const units = [
    { name: 'Sistem Informasi',    code: 'SI',   type: 'department' },
    { name: 'Teknik Komputer',     code: 'TK',   type: 'department' },
    { name: 'Sarana dan Prasarana',code: 'SDP',  type: 'unit'       },
  ];

  for (const u of units) {
    const [rows] = await db.query('SELECT id FROM organization_units WHERE code = ?', [u.code]);
    if (rows.length === 0) {
      // Insert tanpa organization_unit_id dulu (FK off)
      const [result] = await db.query(
        `INSERT INTO organization_units
           (name, code, type, description, organization_unit_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, NOW(), NOW())`,
        [u.name, u.code, u.type, u.name]
      );
      const newId = result.insertId;
      // Update organization_unit_id = id sendiri (self-reference)
      await db.query('UPDATE organization_units SET organization_unit_id = ? WHERE id = ?', [newId, newId]);
      ok(`Organization unit "${u.name}" dibuat (id=${newId})`);
    } else {
      skip(`Organization unit "${u.name}"`);
    }
  }

  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

// ─── 6. USERS ─────────────────────────────────────────────────────────────────
async function seedUsers() {
  log('Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const users = [
    { name: 'Siti',           email: 'pengguna@ftiunand.ac.id' }, // Berhasil disesuaikan ke Siti
    { name: 'Citra Maharani', email: 'pj@ftiunand.ac.id' },
    { name: 'Deni Saputra',   email: 'pengelola@ftiunand.ac.id' },
    { name: 'Eka Putri',      email: 'pj2@ftiunand.ac.id' },
  ];

  for (const user of users) {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [user.email]);
    if (rows.length === 0) {
      await db.query(
        'INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [user.name, user.email, hashedPassword]
      );
      ok(`User "${user.name}" (${user.email}) dibuat`);
    } else {
      skip(`User "${user.name}" (${user.email})`);
    }
  }
}

// ─── 7. EMPLOYEES ─────────────────────────────────────────────────────────────
async function seedEmployees() {
  log('Seeding employees...');

  const [[unitSarana]] = await db.query("SELECT id FROM organization_units WHERE code = 'SDP'");
  const [[unitSI]]     = await db.query("SELECT id FROM organization_units WHERE code = 'SI'");
  const [[statTK]]     = await db.query("SELECT id FROM employment_statuses WHERE name = 'Tenaga Kependidikan'");
  const [[statDosen]]  = await db.query("SELECT id FROM employment_statuses WHERE name = 'Dosen Tetap'");

  if (!unitSarana || !unitSI || !statTK || !statDosen) {
    console.error('  ✗  Prerequisite (organization_units/employment_statuses) tidak lengkap');
    return;
  }

  const [[userCitra]] = await db.query("SELECT id FROM users WHERE email = 'pj@ftiunand.ac.id'");
  const [[userDeni]]  = await db.query("SELECT id FROM users WHERE email = 'pengelola@ftiunand.ac.id'");
  const [[userEka]]   = await db.query("SELECT id FROM users WHERE email = 'pj2@ftiunand.ac.id'");

  const employees = [
    {
      userId: userCitra?.id,
      employee_number: 'EMP001',
      name: 'Citra Maharani',
      birth_place: 'Padang',
      birth_date: '1985-05-10',
      gender: 'female',
      marital_status: 'married',
      address: 'Jl. Kampus No. 1',
      organization_unit_id: unitSarana.id,
      hire_date: '2010-01-01',
      employment_status_id: statTK.id,
    },
    {
      userId: userDeni?.id,
      employee_number: 'EMP002',
      name: 'Deni Saputra',
      birth_place: 'Bukittinggi',
      birth_date: '1980-03-15',
      gender: 'male',
      marital_status: 'married',
      address: 'Jl. Universitas No. 5',
      organization_unit_id: unitSarana.id,
      hire_date: '2008-06-01',
      employment_status_id: statTK.id,
    },
    {
      userId: userEka?.id,
      employee_number: 'EMP003',
      name: 'Eka Putri',
      birth_place: 'Pariaman',
      birth_date: '1990-07-20',
      gender: 'female',
      marital_status: 'single',
      address: 'Jl. Limau Manis No. 3',
      organization_unit_id: unitSI.id,
      hire_date: '2015-03-01',
      employment_status_id: statDosen.id,
    }
  ];

  await db.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const emp of employees) {
    if (!emp.userId) { warn(`User untuk ${emp.name} (${emp.employee_number}) tidak ditemukan di DB, lewati`); continue; }

    const [rows] = await db.query('SELECT id FROM employees WHERE employee_number = ?', [emp.employee_number]);
    if (rows.length === 0) {
      await db.query(
        `INSERT INTO employees 
           (id, employee_number, name, birth_place, birth_date, gender, marital_status, 
            address, organization_unit_id, hire_date, employment_status_id, status, 
            created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [
          emp.userId, emp.employee_number, emp.name, emp.birth_place, emp.birth_date,
          emp.gender, emp.marital_status, emp.address, emp.organization_unit_id,
          emp.hire_date, emp.employment_status_id
        ]
      );
      ok(`Employee "${emp.name}" (${emp.employee_number}) dibuat dengan id=${emp.userId}`);
    } else {
      skip(`Employee "${emp.name}" (${emp.employee_number})`);
    }
  }

  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

// ─── 8. STUDENTS ─────────────────────────────────────────────
async function seedStudents() {
  log('Seeding students...');
  // Mencari ID User berdasarkan email Siti (pengguna@ftiunand.ac.id)
  const [[user]] = await db.query("SELECT id FROM users WHERE email = 'pengguna@ftiunand.ac.id'");
  if (!user) { warn('User pengguna@ftiunand.ac.id tidak ditemukan'); return; }

  const [rows] = await db.query('SELECT id FROM students WHERE regno = ?', ['2410000004']);
  if (rows.length === 0) {
    await db.query(
      `INSERT INTO students (id, name, regno, email, campus_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [user.id, 'Siti', '2410000004', 'pengguna@ftiunand.ac.id', '2110000001@student.ftiunand.ac.id']
    );
    ok(`Student "Siti" dibuat (id=${user.id})`);
  } else {
    skip('Student "Siti" (2410000004)');
  }
}

// ─── 9. MODEL_HAS_ROLES ──────────────────────────────────────────────────────
async function seedModelHasRoles() {
  log('Seeding model_has_roles...');

  const [[uSiti]]      = await db.query("SELECT id FROM users WHERE email = 'pengguna@ftiunand.ac.id'");
  const [[uPj]]        = await db.query("SELECT id FROM users WHERE email = 'pj@ftiunand.ac.id'");
  const [[uPengelola]] = await db.query("SELECT id FROM users WHERE email = 'pengelola@ftiunand.ac.id'");
  const [[uPj2]]       = await db.query("SELECT id FROM users WHERE email = 'pj2@ftiunand.ac.id'");

  const assignments = [];
  if (uSiti)      assignments.push({ role_id: 1, model_id: uSiti.id });      // Siti -> role pengguna (1)
  if (uPj)        assignments.push({ role_id: 2, model_id: uPj.id });        // Citra Maharani -> role penanggung_jawab (2)
  if (uPengelola) assignments.push({ role_id: 3, model_id: uPengelola.id }); // Deni Saputra -> role pengelola_aset (3)
  if (uPj2)       assignments.push({ role_id: 2, model_id: uPj2.id });       // Eka Putri -> role penanggung_jawab (2)

  for (const a of assignments) {
    const [ex] = await db.query(
      "SELECT 1 FROM model_has_roles WHERE role_id = ? AND model_id = ? AND model_type = 'App\\\\Models\\\\User'",
      [a.role_id, a.model_id]
    );
    if (ex.length === 0) {
      await db.query(
        "INSERT INTO model_has_roles (role_id, model_type, model_id) VALUES (?, 'App\\\\Models\\\\User', ?)",
        [a.role_id, a.model_id]
      );
      ok(`User ID ${a.model_id} terikat ke Role ID ${a.role_id}`);
    } else {
      skip(`User ID ${a.model_id} → Role ID ${a.role_id}`);
    }
  }
}

// ─── 10. BUILDINGS ────────────────────────────────────────────────────────────
async function seedBuildings() {
  log('Seeding buildings...');
  const buildings = [
    { name: 'Gedung A FTI', code: 'GDA', description: 'Gedung utama FTI Unand' },
    { name: 'Gedung B FTI', code: 'GDB', description: 'Gedung laboratorium FTI Unand' },
  ];
  for (const b of buildings) {
    const [rows] = await db.query('SELECT id FROM buildings WHERE code = ?', [b.code]);
    if (rows.length === 0) {
      await db.query(
        'INSERT INTO buildings (name, code, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [b.name, b.code, b.description]
      );
      ok(`Building "${b.name}" (${b.code}) dibuat`);
    } else {
      skip(`Building "${b.name}" (${b.code})`);
    }
  }
}

// ─── 11. ASSETS ──────────────────────────────────
async function seedAssets() {
  log('Seeding assets...');
  const assets = [
    { id: 1, name: 'Laptop Laboratorium SI-01', code: 'AST001', type: 'equipment', acquisition_type: 'procurement', acquisition_date: '2024-01-01', acquisition_cost: 12000000.00, condition: 'good', status: 'available' },
    { id: 2, name: 'Proyektor Ruang Seminar', code: 'AST002', type: 'equipment', acquisition_type: 'procurement', acquisition_date: '2024-01-01', acquisition_cost: 8000000.00, condition: 'minor_damage', status: 'available' },
    { id: 3, name: 'AC Lab Komputer A', code: 'AST003', type: 'equipment', acquisition_type: 'procurement', acquisition_date: '2023-01-01', acquisition_cost: 5000000.00, condition: 'good', status: 'available' },
    { id: 4, name: 'Printer Tata Usaha', code: 'AST004', type: 'equipment', acquisition_type: 'procurement', acquisition_date: '2024-02-01', acquisition_cost: 3500000.00, condition: 'major_damage', status: 'available' },
    { id: 5, name: 'Laptop Laboratorium SI-02', code: 'AST005', type: 'equipment', acquisition_type: 'procurement', acquisition_date: '2024-03-01', acquisition_cost: 13000000.00, condition: 'good', status: 'available' }
  ];

  for (const a of assets) {
    const [rows] = await db.query('SELECT id FROM assets WHERE id = ?', [a.id]);
    if (rows.length === 0) {
      await db.query(
        `INSERT INTO assets 
           (id, name, code, type, acquisition_type, acquisition_date, acquisition_cost, \`condition\`, \`status\`, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [a.id, a.name, a.code, a.type, a.acquisition_type, a.acquisition_date, a.acquisition_cost, a.condition, a.status]
      );
      ok(`Asset "${a.name}" berhasil disemai.`);
    } else {
      skip(`Asset "${a.name}"`);
    }
  }
}

// ─── 12. EQUIPMENTS ───────────────────────────────
async function seedEquipments() {
  log('Seeding equipments...');
  const equipments = [
    { id: 1, asset_id: 1, brand: 'Dell', model: 'Latitude 5420', serial_number: 'DLL-LAT5420-001', specification: 'Intel Core i5, RAM 16GB, SSD 512GB', depreciation_value: 2000000.00, useful_life: 5 },
    { id: 2, asset_id: 2, brand: 'Epson', model: 'EB-X41', serial_number: 'EPS-EBX41-002', specification: 'Projector 3600 Lumens', depreciation_value: 1000000.00, useful_life: 5 },
    { id: 3, asset_id: 3, brand: 'Panasonic', model: 'CS-PU9', serial_number: 'PNS-CSPU9-003', specification: 'Air Conditioner 1 PK', depreciation_value: 500000.00, useful_life: 8 },
    { id: 4, asset_id: 4, brand: 'HP', model: 'LaserJet M404n', serial_number: 'HP-M404N-004', specification: 'Monochrome Laser Printer', depreciation_value: 400000.00, useful_life: 5 },
    { id: 5, asset_id: 5, brand: 'Dell', model: 'Latitude 7420', serial_number: 'DLL-LAT7420-005', specification: 'Intel Core i7, RAM 16GB, SSD 512GB', depreciation_value: 2500000.00, useful_life: 5 }
  ];

  for (const eq of equipments) {
    const [rows] = await db.query('SELECT id FROM equipments WHERE id = ?', [eq.id]);
    if (rows.length === 0) {
      await db.query(
        `INSERT INTO equipments 
           (id, asset_id, brand, model, serial_number, specification, purchase_link, photo, depreciation_value, useful_life, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, '-', '-', ?, ?, NOW(), NOW())`,
        [eq.id, eq.asset_id, eq.brand, eq.model, eq.serial_number, eq.specification, eq.depreciation_value, eq.useful_life]
      );
      ok(`Detail Alat Mandiri untuk Equipment ID ${eq.id} dibuat.`);
    } else {
      skip(`Equipment ID ${eq.id}`);
    }
  }
}

// ─── 13. ROOMS ────────────────────────────────────────────────────────────────
async function seedRooms() {
  log('Seeding rooms...');
  const rooms = [
    { id: 1, asset_id: 1, building_id: 2, name: 'Lab Komputer A', code: 'LABA', floor: '1', capacity: 40, is_public: 1, responsible_employee_id: 2, employee_id: 2 },
    { id: 2, asset_id: 2, building_id: 2, name: 'Lab Komputer B', code: 'LABB', floor: '1', capacity: 40, is_public: 1, responsible_employee_id: 2, employee_id: 2 },
    { id: 3, asset_id: 3, building_id: 2, name: 'Lab Jaringan', code: 'LABJ', floor: '2', capacity: 30, is_public: 1, responsible_employee_id: 2, employee_id: 2 },
    { id: 4, asset_id: 4, building_id: 1, name: 'Ruang Dosen SI', code: 'RDSI', floor: '2', capacity: 20, is_public: 0, responsible_employee_id: 4, employee_id: 4 },
    { id: 5, asset_id: 5, building_id: 1, name: 'Ruang Seminar FTI', code: 'RSFTI', floor: '1', capacity: 100, is_public: 1, responsible_employee_id: 4, employee_id: 4 }
  ];

  for (const r of rooms) {
    const [rows] = await db.query('SELECT id FROM rooms WHERE id = ?', [r.id]);
    if (rows.length === 0) {
      await db.query(
        `INSERT INTO rooms 
           (id, asset_id, building_id, name, code, floor, capacity, is_public, responsible_employee_id, employee_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [r.id, r.asset_id, r.building_id, r.name, r.code, r.floor, r.capacity, r.is_public, r.responsible_employee_id, r.employee_id]
      );
      ok(`Room "${r.name}" terbuat.`);
    } else {
      skip(`Room "${r.name}"`);
    }
  }
}

// ─── 14. MAINTENANCE TRANSACTIONS (SIMAINT - Alur Transaksi) ──────────────────
async function seedTransactions() {
  log('Cleaning and Seeding Maintenance Transactions...');
  
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  await db.query('TRUNCATE TABLE equipment_maintenance_request_log');
  await db.query('TRUNCATE TABLE equipment_maintenance_requests');
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  ok("Tabel transaksi permohonan & log dibersihkan (Fresh State).");

const [[citra]] = await db.query(
  "SELECT id FROM employees WHERE employee_number = 'EMP001'"
);

const [[deni]] = await db.query(
  "SELECT id FROM employees WHERE employee_number = 'EMP002'"
);

const [[eka]] = await db.query(
  "SELECT id FROM employees WHERE employee_number = 'EMP003'"
);

const idPembawaLaporan = citra.id;
const idPj             = eka.id;
const idPengelola      = deni.id;

  const requests = [
    { id: 1, equipment_id: 2, reported_by: idPembawaLaporan, issue_description: 'Proyektor tidak menyala saat digunakan', status: 'reported', employee_id: idPj, reported_at: '2026-06-09 15:50:02' },
    { id: 2, equipment_id: 4, reported_by: idPembawaLaporan, issue_description: 'Printer mengalami paper jam', status: 'reported', employee_id: idPengelola, reported_at: '2026-06-09 15:50:02' },
    { id: 3, equipment_id: 1, reported_by: idPj,             issue_description: 'Laptop berjalan lambat saat digunakan', status: 'in_progress', employee_id: idPengelola, reported_at: '2026-06-09 15:50:02' },
    { id: 4, equipment_id: 3, reported_by: idPj,             issue_description: 'AC tidak mengeluarkan udara dingin', status: 'in_progress', employee_id: idPengelola, reported_at: '2026-06-09 15:50:02' },
    { id: 5, equipment_id: 5, reported_by: idPengelola,      issue_description: 'Laptop berhasil diperbaiki dan kembali normal', status: 'resolved', employee_id: idPengelola, reported_at: '2026-06-09 15:50:02', resolved_at: '2026-06-08 15:26:00' }
  ];

  for (const req of requests) {
    await db.query(
      `INSERT INTO equipment_maintenance_requests
         (id, equipment_id, reported_by, issue_description, status, reported_at, resolved_at, employee_id, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [req.id, req.equipment_id, req.reported_by, req.issue_description, req.status, req.reported_at, req.resolved_at || null, req.employee_id]
    );
  }
  ok("5 Data Induk Permohonan Perbaikan Aset ditambah.");

  const logs = [
    { id: 1, equipment_maintenance_request_id: 1, log: 'Laporan diterima', logged_by: idPj, logged_at: '2026-05-23 08:00:00', verified_by: idPengelola, verified_at: '2026-05-23 08:00:00', description: 'Menunggu pemeriksaan', status: '0' },
    { id: 2, equipment_maintenance_request_id: 1, log: 'Pemeriksaan awal', logged_by: idPj, logged_at: '2026-05-23 09:00:00', verified_by: idPengelola, verified_at: '2026-05-23 09:00:00', description: 'Sedang diperiksa', status: '1' },
    { id: 3, equipment_maintenance_request_id: 2, log: 'Laporan printer', logged_by: idPj, logged_at: '2026-05-23 10:00:00', verified_by: idPengelola, verified_at: '2026-05-23 10:00:00', description: 'Kerusakan teridentifikasi', status: '0' },
    { id: 4, equipment_maintenance_request_id: 3, log: 'Perbaikan laptop', logged_by: idPengelola, logged_at: '2026-05-23 11:00:00', verified_by: idPj, verified_at: '2026-05-23 11:00:00', description: 'Penggantian komponen', status: '1' },
    { id: 5, equipment_maintenance_request_id: 5, log: 'Perbaikan selesai', logged_by: idPengelola, logged_at: '2026-05-24 08:00:00', verified_by: idPj, verified_at: '2026-05-24 08:00:00', description: 'Alat kembali normal', status: '2' }
  ];

  for (const l of logs) {
    await db.query(
      `INSERT INTO equipment_maintenance_request_log 
         (id, equipment_maintenance_request_id, log, logged_by, logged_at, log_file, verified_by, verified_at, verification_file, description, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, '-', ?, ?, '-', ?, ?, NOW(), NOW())`,
      [l.id, l.equipment_maintenance_request_id, l.log, l.logged_by, l.logged_at, l.verified_by, l.verified_at, l.description, l.status]
    );
  }
  ok("5 Data Log Histori Tahapan Perbaikan berhasil ditambah.");
}

// ─── MAIN EXECUTION ───────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('       SEED AUTOMATION DATABASE SYSTEM SIMAINT        ');
  console.log('═══════════════════════════════════════════════════════');

  try {
    await seedRoles();
    await seedPermissions();
    await seedRolePermissions();
    await seedEmploymentStatuses();
    await seedOrganizationUnits();
    await seedUsers();
    await seedEmployees();
    await seedStudents();
    await seedModelHasRoles();
    await seedBuildings();
    await seedAssets();
    await seedEquipments();
    await seedRooms();
    await seedTransactions();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✓  Proses Seeding Database SIMAINT Selesai Sempurna! ');
    console.log('═══════════════════════════════════════════════════════');

  } catch (err) {
    console.error('\n  ✗  Gagal Melakukan Inisialisasi Data:', err.message);
    await db.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    process.exit(1);
  } finally {
    await db.end();
    process.exit(0);
  }
}

main();