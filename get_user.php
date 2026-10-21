
<?php
session_start();

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Not logged in'
    ]);
    exit;
}

try {
    $userId = (int) $_SESSION['user_id'];

    $stmt = $pdo->prepare(
        "SELECT id, name, email, role, created_at
         FROM users
         WHERE id = ?
         LIMIT 1"
    );

    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'User not found'
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'user' => $user
    ]);

} catch (PDOException $e) {
    error_log($e->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to retrieve user profile'
    ]);
}
