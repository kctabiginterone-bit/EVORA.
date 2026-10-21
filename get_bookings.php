
<?php
session_start();

header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');

function json_out(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    require __DIR__ . '/db.php';

    if (empty($_SESSION['user_id'])) {
        json_out([
            'success' => false,
            'message' => 'Not logged in'
        ], 401);
    }

    $uid = (int) $_SESSION['user_id'];

    // Get the logged-in user's role.
    $stmt = $pdo->prepare(
        'SELECT id, name, role FROM users WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $uid]);
    $user = $stmt->fetch();

    if (!$user) {
        session_destroy();
        json_out([
            'success' => false,
            'message' => 'Account not found'
        ], 401);
    }

    $isFreelancer = ($user['role'] === 'freelancer');

    if ($isFreelancer) {
        $sql = "SELECT
                    b.id, b.project_id, b.start_date, b.end_date,
                    b.rate, b.note, b.status, b.created_at, b.updated_at,
                    o.id AS other_id,
                    o.name AS other_name,
                    o.company AS other_detail,
                    p.title AS project_title
                FROM bookings b
                JOIN users o ON o.id = b.client_id
                LEFT JOIN projects p ON p.id = b.project_id
                WHERE b.freelancer_id = :uid
                ORDER BY b.created_at DESC, b.id DESC
                LIMIT 500";
    } else {
        $sql = "SELECT
                    b.id, b.project_id, b.start_date, b.end_date,
                    b.rate, b.note, b.status, b.created_at, b.updated_at,
                    o.id AS other_id,
                    o.name AS other_name,
                    o.headline AS other_detail,
                    p.title AS project_title
                FROM bookings b
                JOIN users o ON o.id = b.freelancer_id
                LEFT JOIN projects p ON p.id = b.project_id
                WHERE b.client_id = :uid
                ORDER BY b.created_at DESC, b.id DESC
                LIMIT 500";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['uid' => $uid]);
    $bookings = $stmt->fetchAll();

    $stats = [
        'total' => 0,
        'pending' => 0,
        'accepted' => 0,
        'hired' => 0
    ];

    $people = [];

    foreach ($bookings as &$b) {
        $b['id'] = (int) $b['id'];
        $b['project_id'] = $b['project_id'] === null
            ? null
            : (int) $b['project_id'];
        $b['other_id'] = (int) $b['other_id'];
        $b['rate'] = (float) $b['rate'];

        $stats['total']++;

        if ($b['status'] === 'pending') {
            $stats['pending']++;
        }

        if ($b['status'] === 'accepted') {
            $stats['accepted']++;
        }

        if (in_array($b['status'], ['accepted', 'completed'], true)) {
            $people[$b['other_id']] = true;
        }
    }
    unset($b);

    $stats['hired'] = count($people);

    json_out([
        'success' => true,
        'role' => $user['role'],
        'stats' => $stats,
        'bookings' => $bookings
    ]);

} catch (Throwable $e) {
    error_log('Get bookings error: ' . $e->getMessage());

    json_out([
        'success' => false,
        'message' => 'Could not load bookings. Please check the bookings table and database columns.'
    ], 500);
}
