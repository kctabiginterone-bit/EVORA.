
<?php
header('Content-Type: application/json');
require 'db.php';

$name     = trim($_POST['name'] ?? '');
$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';
$role     = strtolower(trim($_POST['role'] ?? ''));

// Allow only these two roles during registration
if (!in_array($role, ['client', 'freelancer'], true)) {
    echo json_encode([
        'success' => false,
        'message' => 'Please select Client or Freelancer.'
    ]);
    exit;
}

// Validate inputs
if (
    $name === '' ||
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    strlen($password) < 6
) {
    echo json_encode([
        'success' => false,
        'message' => 'Please enter valid information. Password must be at least 6 characters.'
    ]);
    exit;
}

// Check if email already exists
$stmt = $pdo->prepare(
    "SELECT id FROM users WHERE email = :email"
);
$stmt->execute(['email' => $email]);

if ($stmt->fetch()) {
    echo json_encode([
        'success' => false,
        'message' => 'Email already registered.'
    ]);
    exit;
}

// Save the user and selected role
$stmt = $pdo->prepare(
    "INSERT INTO users (name, email, password, role)
     VALUES (:name, :email, :password, :role)"
);

$stmt->execute([
    'name'     => $name,
    'email'    => $email,
    'password' => password_hash($password, PASSWORD_DEFAULT),
    'role'     => $role
]);

echo json_encode([
    'success' => true,
    'message' => 'Account created successfully.'
]);
