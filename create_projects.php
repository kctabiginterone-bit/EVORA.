<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

function fail($message) {
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

try {
    require 'db.php';

    $categories = ['Design & Creative', 'Development', 'Marketing', 'Writing', 'Other'];

    $title       = trim($_POST['title'] ?? '');
    $category    = trim($_POST['category'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $budget      = $_POST['budget'] ?? '';
    $deadline    = trim($_POST['deadline'] ?? '');

    if ($title === '' || mb_strlen($title) > 150) {
        fail('Please enter a project title (max 150 characters).');
    }
    if (!in_array($category, $categories, true)) {
        fail('Please choose a category.');
    }
    if (!is_numeric($budget) || (float)$budget < 0 || (float)$budget > 9999999999) {
        fail('Please enter a valid budget.');
    }

    $deadlineValue = null;
    if ($deadline !== '') {
        $d = DateTime::createFromFormat('Y-m-d', $deadline);
        if (!$d || $d->format('Y-m-d') !== $deadline) {
            fail('Invalid deadline date.');
        }
        $deadlineValue = $deadline;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO projects (user_id, title, description, category, budget, deadline)
         VALUES (:user_id, :title, :description, :category, :budget, :deadline)"
    );
    $stmt->execute([
        'user_id'     => $_SESSION['user_id'],
        'title'       => $title,
        'description' => $description,
        'category'    => $category,
        'budget'      => $budget,
        'deadline'    => $deadlineValue,
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Project posted',
        'id'      => (int)$pdo->lastInsertId(),
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Could not save the project. Make sure the projects table exists.']);
}