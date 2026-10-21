
<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not logged in'
    ]);
    exit;
}

try {
    require 'db.php';

    $uid = (int) $_SESSION['user_id'];

    
    $stmt = $pdo->prepare(
        "SELECT
            p.id,
            p.title,
            p.description,
            p.category,
            p.budget,
            p.deadline,
            p.status,
            p.progress,
            p.created_at
        FROM projects p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id <> :uid
        AND p.freelancer_id IS NULL
        AND LOWER(p.status) = 'pending'
        AND u.role = 'client'
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 200"
    );

$stmt->execute(['uid' => $uid]);


    $stmt->execute(['uid' => $uid]);
    $projects = $stmt->fetchAll();

    foreach ($projects as &$p) {
        $p['id'] = (int) $p['id'];
        $p['budget'] = (float) $p['budget'];
        $p['progress'] = (int) $p['progress'];
    }
    unset($p);

    echo json_encode([
        'success' => true,
        'projects' => $projects
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Could not load available projects.'
    ]);
}
