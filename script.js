
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('mainNav');

menuToggle?.addEventListener('click', () => {
  const opened = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(opened));
  menuToggle.textContent = opened ? '×' : '☰';
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', (e) => {
    nav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');

    if (menuToggle) menuToggle.textContent = '☰';

    const label = link.dataset.info;

    if (label) {
      e.preventDefault();
      showInfo(label);
    }
  });
});

function showInfo(label) {
  const title = document.getElementById('modalTitle');
  const desc = document.getElementById('modalDescription');

  openModal('info');

  title.textContent = label;

  const descriptions = {
    'Browse Freelancers':
      'Explore a network of skilled creatives, developers, and project specialists.',
    'How It Works':
      'Create an account, find the right talent, agree on project details, and track your work.',
    'About Evora':
      'Evora brings clients and freelancers together so teams can connect and collaborate.'
  };

  desc.textContent =
    descriptions[label] || 'Discover the Evora workspace.';
}

const backdrop = document.getElementById('modalBackdrop');
const authForm = document.getElementById('authForm');

let mode = 'login';

function openModal(nextMode) {
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';

  authForm.hidden = false;
  document.getElementById('modalSwitch').hidden = false;

  if (nextMode === 'info') {
    authForm.hidden = true;
    document.getElementById('modalSwitch').hidden = true;
    return;
  }

  setMode(nextMode === 'signup' ? 'signup' : 'login');
}

function closeModal() {
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('formMessage').textContent = '';
}

function setMode(nextMode) {
  mode = nextMode;

  const nameField = document.getElementById('nameField');
  const roleField = document.getElementById('roleField');
  const passwordField = document.getElementById('passwordField');
  const submitBtn = document.getElementById('submitAuth');
  const modalSwitch = document.getElementById('modalSwitch');

  document.getElementById('modalTitle').textContent =
    mode === 'login' ? 'Welcome back' : 'Create your account';

  document.getElementById('modalDescription').textContent =
    mode === 'login'
      ? 'Log in to continue to your Evora workspace.'
      : 'Sign up to start connecting and collaborating.';

  nameField.hidden = mode !== 'signup';
  nameField.required = mode === 'signup';

  roleField.hidden = mode !== 'signup';
  roleField.required = mode === 'signup';

  // Clear the role when switching modes so it must be
  // deliberately selected during registration.
  if (mode === 'signup') {
    roleField.value = '';
  }

  passwordField.autocomplete =
    mode === 'login' ? 'current-password' : 'new-password';

  submitBtn.textContent =
    mode === 'login' ? 'Log In' : 'Create Account';

  modalSwitch.innerHTML =
    mode === 'login'
      ? 'New to Evora? <a href="#" id="switchMode">Create an account</a>'
      : 'Already have an account? <a href="#" id="switchMode">Log in</a>';

  document.getElementById('formMessage').textContent = '';
}

// Use one click handler for switching between login and signup.
document.getElementById('modalSwitch').addEventListener('click', (e) => {
  if (e.target.id === 'switchMode') {
    e.preventDefault();
    setMode(mode === 'login' ? 'signup' : 'login');
  }
});

document.querySelectorAll('[data-modal]').forEach((btn) => {
  btn.addEventListener('click', () => openModal(btn.dataset.modal));
});

document.getElementById('closeModal').addEventListener('click', closeModal);

backdrop.addEventListener('click', (e) => {
  if (e.target === backdrop) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// LOGIN / SIGN UP
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = document.getElementById('formMessage');
  const submitBtn = document.getElementById('submitAuth');
  const password = document.getElementById('passwordField').value;
  const roleField = document.getElementById('roleField');

  message.textContent = '';

  if (password.length < 6) {
    message.textContent =
      'Please use at least 6 characters for your password.';
    return;
  }

  // Require a role only during sign up.
  if (mode === 'signup' && !roleField.value) {
    message.textContent = 'Please select Client or Freelancer.';
    return;
  }

  const url =
    mode === 'login' ? 'api/login.php' : 'api/register.php';

  submitBtn.disabled = true;

  try {
    // Send name, email, password and selected role during signup.
    // During login, send only email and password.
    const formData = new FormData();

    formData.append(
      'email',
      document.getElementById('emailField').value.trim()
    );
    formData.append('password', password);

    if (mode === 'signup') {
      formData.append(
        'name',
        document.getElementById('nameField').value.trim()
      );
      formData.append('role', roleField.value);
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      message.textContent =
        data.message || 'Something went wrong. Please try again.';
      return;
    }

    if (mode === 'signup') {
      authForm.reset();
      setMode('login');

      message.textContent =
        'Account created successfully! Please log in.';
      return;
    }

    // The backend should verify the account and create the session.
    // The shared dashboard loads the logged-in user's role from me.php.
    window.location.href = data.redirect || 'dashboard.html';

  } catch (err) {
    console.error('Authentication error:', err);

    message.textContent =
      'Could not reach the server. Make sure Apache and MySQL are running and that you opened Evora through localhost.';
  } finally {
    submitBtn.disabled = false;
  }
});
