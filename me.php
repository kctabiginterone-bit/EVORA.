
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

    $stmt = $pdo->prepare(
        "SELECT * FROM users WHERE id = :id LIMIT 1"
    );

    $stmt->execute([
        'id' => $_SESSION['user_id']
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        session_destroy();

        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Account not found'
        ]);
        exit;
    }

    $role = strtolower(trim($row['role'] ?? ''));

    if (!in_array($role, ['client', 'freelancer', 'admin'], true)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid account role'
        ]);
        exit;
    }

    $_SESSION['user_role'] = $role;

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'role' => $role,
            'created_at' => $row['created_at'] ?? null,
            'company' => $row['company'] ?? '',
            'about' => $row['about'] ?? '',
            'location' => $row['location'] ?? '',
            'headline' => $row['headline'] ?? '',
            'category' => $row['category'] ?? '',
            'hourly_rate' => isset($row['hourly_rate'])
                ? (float) $row['hourly_rate']
                : null,
            'skills' => $row['skills'] ?? '',
            'availability' => $row['availability'] ?? 'available'
        ]
    ]);

} catch (PDOException $e) {
    error_log($e->getMessage());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to retrieve user profile'
    ]);
}
