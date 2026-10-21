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

    $id       = $_SESSION['user_id'];
    $name     = trim($_POST['name'] ?? '');
    $email    = trim($_POST['email'] ?? '');
    $company  = trim($_POST['company'] ?? '');
    $about    = trim($_POST['about'] ?? '');
    $location = trim($_POST['location'] ?? '');

    if ($name === '' || mb_strlen($name) > 100) {
        fail('Please enter your full name (max 100 characters).');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 100) {
        fail('Please enter a valid email address.');
    }
    if (mb_strlen($company) > 100)  { fail('Company name is too long (max 100 characters).'); }
    if (mb_strlen($location) > 100) { fail('Location is too long (max 100 characters).'); }
    if (mb_strlen($about) > 1000)   { fail('About you is too long (max 1000 characters).'); }

    // email must not belong to someone else
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email AND id <> :id");
    $stmt->execute(['email' => $email, 'id' => $id]);
    if ($stmt->fetch()) {
        fail('That email is already used by another account.');
    }

    $stmt = $pdo->prepare(
        "UPDATE users
            SET name = :name, email = :email, company = :company,
                about = :about, location = :location
          WHERE id = :id"
    );
    $stmt->execute([
        'name'     => $name,
        'email'    => $email,
        'company'  => $company,
        'about'    => $about,
        'location' => $location,
        'id'       => $id,
    ]);

    $_SESSION['user_name'] = $name;

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    echo json_encode([
        'success' => true,
        'message' => 'Profile saved',
        'user'    => [
            'name'       => $row['name'],
            'email'      => $row['email'],
            'created_at' => $row['created_at'],
            'company'    => $row['company']  ?? '',
            'about'      => $row['about']    ?? '',
            'location'   => $row['location'] ?? '',
        ],
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Could not save your profile. Make sure you ran database/users_profile.sql.',
    ]);
}