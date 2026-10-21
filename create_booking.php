
<?php
// Booking endpoint - no bootstrap.php required.

session_start();

date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');

// ----------------------------------------
// 1. JSON RESPONSE HELPERS
// ----------------------------------------

function json_out(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function fail(string $message): void
{
    json_out([
        'success' => false,
        'message' => $message
    ]);
}

// ----------------------------------------
// 2. LOGIN AND USER HELPERS
// ----------------------------------------

function require_login(): int
{
    if (empty($_SESSION['user_id'])) {
        json_out([
            'success' => false,
            'message' => 'Not logged in'
        ], 401);
    }

    return (int) $_SESSION['user_id'];
}

function get_user(PDO $pdo, int $id): array
{
    $stmt = $pdo->prepare(
        'SELECT * FROM users WHERE id = :id'
    );

    $stmt->execute(['id' => $id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        session_destroy();

        json_out([
            'success' => false,
            'message' => 'Account not found'
        ], 401);
    }

    if (!isset($user['role'])) {
        fail(
            'The database is not updated yet. Run database/booking.sql in phpMyAdmin first.'
        );
    }

    return $user;
}

function require_role(array $user, string $role): void
{
    if (($user['role'] ?? '') !== $role) {
        fail(
            $role === 'client'
                ? 'Only client accounts can do this.'
                : 'Only freelancer accounts can do this.'
        );
    }
}

function valid_date(string $value): ?DateTime
{
    $date = DateTime::createFromFormat('!Y-m-d', $value);

    return (
        $date &&
        $date->format('Y-m-d') === $value
    ) ? $date : null;
}

// ----------------------------------------
// 3. DATABASE CONNECTION
// ----------------------------------------

try {
    require __DIR__ . '/db.php';

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException(
            'Database connection was not initialized.'
        );
    }

    // ----------------------------------------
    // 4. CHECK REQUEST METHOD
    // ----------------------------------------

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_out([
            'success' => false,
            'message' => 'Invalid request method.'
        ], 405);
    }

    // ----------------------------------------
    // 5. CHECK LOGIN AND CLIENT ROLE
    // ----------------------------------------

    $uid = require_login();
    $user = get_user($pdo, $uid);

    require_role($user, 'client');

    // ----------------------------------------
    // 6. READ FORM INPUTS
    // ----------------------------------------

    $freelancerId = filter_var(
        $_POST['freelancer_id'] ?? null,
        FILTER_VALIDATE_INT
    );

    $projectId = filter_var(
        $_POST['project_id'] ?? 0,
        FILTER_VALIDATE_INT
    );

    $startRaw = is_string($_POST['start_date'] ?? null)
        ? trim($_POST['start_date'])
        : '';

    $endRaw = is_string($_POST['end_date'] ?? null)
        ? trim($_POST['end_date'])
        : '';

    $note = is_string($_POST['note'] ?? null)
        ? trim($_POST['note'])
        : '';

    if (!$freelancerId || $freelancerId < 1) {
        fail('Please select a valid freelancer.');
    }

    if ($projectId === false || $projectId < 0) {
        fail('Please select a valid project.');
    }

    $noteLength = function_exists('mb_strlen')
        ? mb_strlen($note, 'UTF-8')
        : strlen($note);

    if ($noteLength > 1000) {
        fail('The note is too long (maximum 1000 characters).');
    }

    // ----------------------------------------
    // 7. FIND THE FREELANCER
    // ----------------------------------------

    $stmt = $pdo->prepare(
        "SELECT id, name, hourly_rate, availability
         FROM users
         WHERE id = :id
           AND role = 'freelancer'
         LIMIT 1"
    );

    $stmt->execute([
        'id' => $freelancerId
    ]);

    $freelancer = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$freelancer) {
        fail('That freelancer could not be found.');
    }

    if (
        $freelancer['hourly_rate'] === null ||
        !is_numeric($freelancer['hourly_rate']) ||
        (float) $freelancer['hourly_rate'] < 0
    ) {
        fail('This freelancer does not have a valid hourly rate.');
    }

    if ($freelancer['availability'] !== 'available') {
        fail('This freelancer is not accepting bookings right now.');
    }

    // ----------------------------------------
    // 8. VALIDATE BOOKING DATES
    // ----------------------------------------

    $start = valid_date($startRaw);
    $end = valid_date($endRaw);

    if (!$start || !$end) {
        fail('Please choose a valid start date and end date.');
    }

    $today = new DateTime('today');

    if ($start < $today) {
        fail('The start date cannot be in the past.');
    }

    if ($end < $start) {
        fail('The end date cannot be before the start date.');
    }

    if ($start->diff($end)->days > 365) {
        fail('A booking can be at most one year long.');
    }

    $startDate = $start->format('Y-m-d');
    $endDate = $end->format('Y-m-d');

    // ----------------------------------------
    // 9. CHECK THE OPTIONAL PROJECT
    // ----------------------------------------

    $projectValue = null;

    if ($projectId > 0) {
        $stmt = $pdo->prepare(
            "SELECT id, status, freelancer_id
             FROM projects
             WHERE id = :id
               AND user_id = :uid
             LIMIT 1"
        );

        $stmt->execute([
            'id' => $projectId,
            'uid' => $uid
        ]);

        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            fail('That project could not be found.');
        }

        if (strtolower((string) $project['status']) === 'done') {
            fail('That project is already completed.');
        }

        if ($project['freelancer_id'] !== null) {
            fail('That project already has a freelancer assigned.');
        }

        $projectValue = $projectId;
    }

    // ----------------------------------------
    // 10. PREVENT DUPLICATE PENDING REQUESTS
    // ----------------------------------------

    if ($projectValue === null) {
        $stmt = $pdo->prepare(
            "SELECT id
             FROM bookings
             WHERE client_id = :client
               AND freelancer_id = :freelancer
               AND status = 'pending'
               AND project_id IS NULL
             LIMIT 1"
        );

        $stmt->execute([
            'client' => $uid,
            'freelancer' => $freelancerId
        ]);
    } else {
        $stmt = $pdo->prepare(
            "SELECT id
             FROM bookings
             WHERE client_id = :client
               AND freelancer_id = :freelancer
               AND status = 'pending'
               AND project_id = :project
             LIMIT 1"
        );

        $stmt->execute([
            'client' => $uid,
            'freelancer' => $freelancerId,
            'project' => $projectValue
        ]);
    }

    if ($stmt->fetch(PDO::FETCH_ASSOC)) {
        fail(
            'You already sent a pending request to this freelancer for that project.'
        );
    }

    // ----------------------------------------
    // 11. CHECK FREELANCER DATE AVAILABILITY
    // ----------------------------------------

    $stmt = $pdo->prepare(
        "SELECT id
         FROM bookings
         WHERE freelancer_id = :freelancer
           AND status = 'accepted'
           AND start_date <= :end_date
           AND end_date >= :start_date
         LIMIT 1"
    );

    $stmt->execute([
        'freelancer' => $freelancerId,
        'end_date' => $endDate,
        'start_date' => $startDate
    ]);

    if ($stmt->fetch(PDO::FETCH_ASSOC)) {
        fail(
            'This freelancer is already booked on those dates. Please pick different dates.'
        );
    }

    // ----------------------------------------
    // 12. SAVE THE BOOKING REQUEST
    // ----------------------------------------

    $stmt = $pdo->prepare(
        "INSERT INTO bookings (
            client_id,
            freelancer_id,
            project_id,
            start_date,
            end_date,
            rate,
            note
        ) VALUES (
            :client,
            :freelancer,
            :project,
            :start_date,
            :end_date,
            :rate,
            :note
        )"
    );

    $stmt->execute([
        'client' => $uid,
        'freelancer' => $freelancerId,
        'project' => $projectValue,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'rate' => $freelancer['hourly_rate'],
        'note' => $note
    ]);

    // ----------------------------------------
    // 13. SEND SUCCESS RESPONSE TO JAVASCRIPT
    // ----------------------------------------

    json_out([
        'success' => true,
        'message' => 'Booking request sent to ' . $freelancer['name'],
        'id' => (int) $pdo->lastInsertId()
    ]);

} catch (Throwable $e) {
    error_log('Booking endpoint error: ' . $e->getMessage());

    json_out([
        'success' => false,
        'message' => 'Something went wrong on the server. Check your database connection and booking table.'
    ], 500);
}
