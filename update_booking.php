<?php
require __DIR__ . '/bootstrap.php';

try {
    $uid  = require_login();
    $user = get_user($pdo, $uid);

    $id     = (int)($_POST['id'] ?? 0);
    $action = $_POST['action'] ?? '';

    if (!in_array($action, ['accept', 'decline', 'cancel', 'complete'], true)) {
        fail('Unknown action.');
    }

    // lock the row while we change it (SQLite, used only for tests, has no FOR UPDATE)
    $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';

    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = :id' . $lock);
    $stmt->execute(['id' => $id]);
    $booking = $stmt->fetch();

    if (!$booking) {
        $pdo->rollBack();
        fail('Booking not found.');
    }

    $isClientOwner     = (int)$booking['client_id'] === $uid;
    $isFreelancerOwner = (int)$booking['freelancer_id'] === $uid;
    $status            = $booking['status'];
    $message           = '';

    if ($action === 'cancel') {
        if (!$isClientOwner) {
            $pdo->rollBack();
            fail('Only the client who made this booking can cancel it.');
        }
        if (!in_array($status, ['pending', 'accepted'], true)) {
            $pdo->rollBack();
            fail('This booking can no longer be cancelled.');
        }

        if ($status === 'accepted' && $booking['project_id'] !== null) {
            $stmt = $pdo->prepare('SELECT progress FROM projects WHERE id = :p');
            $stmt->execute(['p' => $booking['project_id']]);
            $progress = (int)$stmt->fetchColumn();

            if ($progress > 0) {
                $pdo->rollBack();
                fail('Work has already started on this project, so the booking cannot be cancelled.');
            }

            // release the project so another freelancer can be booked
            $stmt = $pdo->prepare(
                "UPDATE projects SET freelancer_id = NULL, status = 'pending'
                  WHERE id = :p AND freelancer_id = :f"
            );
            $stmt->execute(['p' => $booking['project_id'], 'f' => $booking['freelancer_id']]);
        }

        $newStatus = 'cancelled';
        $message   = 'Booking cancelled';

    } else {
        if (!$isFreelancerOwner) {
            $pdo->rollBack();
            fail('Only the booked freelancer can do this.');
        }

        if ($action === 'accept' || $action === 'decline') {
            if ($status !== 'pending') {
                $pdo->rollBack();
                fail('This request was already answered.');
            }
        }

        if ($action === 'accept') {
            // never accept two bookings that overlap
            $stmt = $pdo->prepare(
                "SELECT COUNT(*) FROM bookings
                  WHERE freelancer_id = :f AND status = 'accepted' AND id <> :id
                    AND start_date <= :end AND end_date >= :start"
            );
            $stmt->execute([
                'f'     => $uid,
                'id'    => $id,
                'end'   => $booking['end_date'],
                'start' => $booking['start_date'],
            ]);
            if ((int)$stmt->fetchColumn() > 0) {
                $pdo->rollBack();
                fail('You already have an accepted booking on those dates.');
            }

            if ($booking['project_id'] !== null) {
                // assign the project to this freelancer and start it
                $stmt = $pdo->prepare(
                    "UPDATE projects SET freelancer_id = :f, status = 'progress'
                      WHERE id = :p AND user_id = :c AND freelancer_id IS NULL AND status <> 'done'"
                );
                $stmt->execute([
                    'f' => $uid,
                    'p' => $booking['project_id'],
                    'c' => $booking['client_id'],
                ]);
                if ($stmt->rowCount() === 0) {
                    $pdo->rollBack();
                    fail('That project is no longer available (it may already be assigned or completed).');
                }

                // The project is taken now, so any other pending request for it is closed
                $stmt = $pdo->prepare(
                    "UPDATE bookings SET status = 'cancelled'
                      WHERE project_id = :p AND id <> :id AND status = 'pending'"
                );
                $stmt->execute(['p' => $booking['project_id'], 'id' => $id]);
            }

            $newStatus = 'accepted';
            $message   = 'Booking accepted';

        } elseif ($action === 'decline') {
            $newStatus = 'declined';
            $message   = 'Booking declined';

        } else { // complete
            if ($status !== 'accepted') {
                $pdo->rollBack();
                fail('Only accepted bookings can be marked as completed.');
            }
            $newStatus = 'completed';
            $message   = 'Booking marked as completed';
        }
    }

    $stmt = $pdo->prepare('UPDATE bookings SET status = :s WHERE id = :id');
    $stmt->execute(['s' => $newStatus, 'id' => $id]);

    $pdo->commit();

    json_out(['success' => true, 'message' => $message, 'status' => $newStatus]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    handle_error($e);
}
