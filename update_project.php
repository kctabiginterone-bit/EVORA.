<?php
require __DIR__ . '/bootstrap.php';

try {
    $uid  = require_login();
    $user = get_user($pdo, $uid);
    require_role($user, 'freelancer');

    $id       = (int)($_POST['id'] ?? 0);
    $progress = $_POST['progress'] ?? '';

    if (!ctype_digit((string)$progress) || (int)$progress > 100) {
        fail('Progress must be a number from 0 to 100.');
    }
    $progress = (int)$progress;

    $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = :id AND freelancer_id = :uid');
    $stmt->execute(['id' => $id, 'uid' => $uid]);
    if (!$stmt->fetch()) {
        fail('That project is not assigned to you.');
    }

    $status = $progress >= 100 ? 'done' : 'progress';

    $stmt = $pdo->prepare('UPDATE projects SET progress = :progress, status = :status WHERE id = :id');
    $stmt->execute(['progress' => $progress, 'status' => $status, 'id' => $id]);

    json_out([
        'success' => true,
        'message' => $progress >= 100 ? 'Project marked as completed' : 'Progress updated',
    ]);
} catch (Throwable $e) {
    handle_error($e);
}
