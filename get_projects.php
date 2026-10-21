<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    require 'db.php';
    $uid = $_SESSION['user_id'];

    // Summary numbers for the stat cards
    $stmt = $pdo->prepare(
        "SELECT
            COUNT(*)                                                   AS total,
            COALESCE(SUM(status = 'progress'), 0)                      AS in_progress,
            COALESCE(SUM(status = 'done'), 0)                          AS completed,
            COALESCE(SUM(CASE WHEN status = 'done' THEN budget END), 0) AS spent,
            COALESCE(SUM(CASE WHEN status <> 'done' THEN budget END), 0) AS active_budget,
            COALESCE(SUM(created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')), 0) AS new_month
         FROM projects
         WHERE user_id = :uid"
    );
    $stmt->execute(['uid' => $uid]);
    $s = $stmt->fetch();

    // Most recent projects
    $stmt = $pdo->prepare(
        "SELECT id, title, description, category, budget, deadline, status, progress, created_at
         FROM projects
         WHERE user_id = :uid
         ORDER BY created_at DESC, id DESC
         LIMIT 200"
    );
    $stmt->execute(['uid' => $uid]);
    $projects = $stmt->fetchAll();

    foreach ($projects as &$p) {
        $p['id']       = (int)$p['id'];
        $p['budget']   = (float)$p['budget'];
        $p['progress'] = (int)$p['progress'];
    }
    unset($p);

    echo json_encode([
        'success'  => true,
        'stats'    => [
            'total'       => (int)$s['total'],
            'in_progress' => (int)$s['in_progress'],
            'completed'   => (int)$s['completed'],
            'spent'       => (float)$s['spent'],
            'active_budget' => (float)$s['active_budget'],
            'new_month'   => (int)$s['new_month'],
        ],
        'projects' => $projects,
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Could not load projects. Make sure the projects table exists.']);
}