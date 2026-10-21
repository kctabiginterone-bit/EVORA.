
<?php
session_start();
header('Content-Type: application/json');

require 'db.php';

$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if ($email === '' || $password === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Please enter your email and password.'
    ]);
    exit;
}

// Find the account using its email
$stmt = $pdo->prepare(
    "SELECT id, name, email, password, role
     FROM users
     WHERE email = :email
     LIMIT 1"
);

$stmt->execute(['email' => $email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Verify the account password
if (!$user || !password_verify($password, $user['password'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid email or password.'
    ]);
    exit;
}

// Read the role saved in the database
$role = strtolower(trim($user['role'] ?? ''));

if (!in_array($role, ['client', 'freelancer', 'admin'], true)) {
    echo json_encode([
        'success' => false,
        'message' => 'Your account role is invalid. Please contact the administrator.'
    ]);
    exit;
}

// Create a new session after successful login
session_regenerate_id(true);

$_SESSION['user_id']   = $user['id'];
$_SESSION['user_name'] = $user['name'];
$_SESSION['user_role'] = $role;

// Return the account role to the frontend
echo json_encode([
    'success'  => true,
    'message'  => 'Login successful.',
    'role'     => $role,
    'redirect' => 'dashboard.html'
]);
