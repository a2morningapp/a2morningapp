import {
  cleanFirebaseString,
  formatTime,
  normalizePhone,
  numericValue,
  parseQuizRecord,
} from './quiz-quiz-core.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDRJjO1v8Ybf7rqVK6r2QfBvmv913bISOc',
  authDomain: 'a2moring.firebaseapp.com',
  databaseURL: 'https://a2moring-default-rtdb.firebaseio.com',
  projectId: 'a2moring',
  storageBucket: 'a2moring.firebasestorage.app',
  messagingSenderId: '528466835850',
  appId: '1:528466835850:web:ee5cfc804c2bdaf71fb073',
  measurementId: 'G-2HVR18MNEZ',
};

const dom = {
  dashboard: document.querySelector('#dashboard'),
  optionView: document.querySelector('#option-view'),
  optionTitle: document.querySelector('#option-title'),
  optionCoins: document.querySelector('#option-coins'),
  optionContent: document.querySelector('#option-content'),
  optionBackButton: document.querySelector('#option-back-button'),
  optionMessage: document.querySelector('#option-message'),
  optionPageMessage: document.querySelector('#option-page-message'),
  quiz: document.querySelector('#quiz'),
  results: document.querySelector('#results'),
  loading: document.querySelector('#loading'),
  loadingMessage: document.querySelector('#loading-message'),
  errorPanel: document.querySelector('#error-panel'),
  errorMessage: document.querySelector('#error-message'),
  playerName: document.querySelector('#player-name'),
  coinBalance: document.querySelector('#coin-balance'),
  sessionNote: document.querySelector('#session-note'),
  startButton: document.querySelector('#start-button'),
  backButton: document.querySelector('#back-button'),
  questionCount: document.querySelector('#question-count'),
  correctCount: document.querySelector('#correct-count'),
  timer: document.querySelector('#timer'),
  questionNumber: document.querySelector('#question-number'),
  questionText: document.querySelector('#question-text'),
  answerList: document.querySelector('#answer-list'),
  quizMessage: document.querySelector('#quiz-message'),
  resultScore: document.querySelector('#result-score'),
  resultTotal: document.querySelector('#result-total'),
  resultMatches: document.querySelector('#result-matches'),
  resultEarned: document.querySelector('#result-earned'),
  resultBalance: document.querySelector('#result-balance'),
  resultSaveNote: document.querySelector('#result-save-note'),
  dashboardButton: document.querySelector('#dashboard-button'),
  againButton: document.querySelector('#again-button'),
  retryButton: document.querySelector('#retry-button'),
  errorBackButton: document.querySelector('#error-back-button'),
  logoutDialog: document.querySelector('#logout-dialog'),
  cancelLogout: document.querySelector('#cancel-logout'),
  confirmLogout: document.querySelector('#confirm-logout'),
};

const params = new URLSearchParams(window.location.search);
const linkPhone = normalizePhone(params.get('phone'));
const sessionKey = `a2-web-quiz:${linkPhone || 'guest'}`;
let localStorageAvailable = true;
const savedSession = readLocalSession(sessionKey);
const linkCoins = numericValue(params.get('coins'));

const state = {
  name: cleanFirebaseString(params.get('name') || savedSession.name || ''),
  phone: linkPhone || normalizePhone(savedSession.phone),
  coins: numericValue(savedSession.coins, linkCoins),
  profile: null,
  questions: [],
  questionIndex: 0,
  correct: 0,
  matches: 0,
  earned: 0,
  secondsRemaining: 150,
  timerId: null,
  advanceTimeoutId: null,
  answerLocked: false,
};

console.info('[Web Quiz] Deep-link context received', {
  nameProvided: Boolean(params.get('name')),
  phoneProvided: Boolean(params.get('phone')),
  coinsProvided: params.has('coins'),
  lastSeenProvided: params.has('ls'),
  pushIdProvided: params.has('push'),
});

function readLocalSession(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const saved = JSON.parse(raw);
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    console.error('[Web Quiz] Could not read the saved browser session:', error);
    localStorageAvailable = false;
    return {};
  }
}

function persistLocalSession() {
  try {
    window.localStorage.setItem(sessionKey, JSON.stringify({
      name: state.name,
      phone: state.phone,
      coins: state.coins,
      correct: state.correct,
      matches: state.matches,
    }));
    return true;
  } catch (error) {
    console.error('[Web Quiz] Could not save quiz progress in this browser:', error);
    localStorageAvailable = false;
    return false;
  }
}

function firebaseUrl(path) {
  const encodedPath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${firebaseConfig.databaseURL.replace(/\/$/, '')}/${encodedPath}.json`;
}

async function readFirebase(path) {
  const response = await fetch(firebaseUrl(path), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firebase read failed (${response.status}): ${detail || response.statusText}`);
  }
  return response.json();
}

function setScreen(screen) {
  dom.dashboard.hidden = screen !== 'dashboard';
  dom.optionView.hidden = screen !== 'option';
  dom.quiz.hidden = screen !== 'quiz';
  dom.results.hidden = screen !== 'results';
  dom.loading.hidden = screen !== 'loading';
  dom.errorPanel.hidden = screen !== 'error';
}

function updateHeader() {
  dom.playerName.textContent = state.name ? `, ${state.name}` : '';
  dom.coinBalance.textContent = String(state.coins);
  dom.optionCoins.textContent = String(state.coins);
}

function showError(error, retry) {
  console.error('[Web Quiz] Unable to continue:', error);
  dom.errorMessage.textContent = error instanceof Error ? error.message : 'An unexpected error occurred.';
  dom.retryButton.hidden = !retry;
  setScreen('error');
}

async function loadPlayerData() {
  if (!state.phone) {
    dom.sessionNote.textContent = 'Guest quiz: open this page from A2 Morning with a phone number to load your account. Coins earned here stay in this browser.';
    updateHeader();
    return;
  }

  try {
    const user = await readFirebase(`DATA/${state.phone}`);
    if (user && typeof user === 'object' && !Array.isArray(user)) {
      state.profile = user;
      if (!params.has('name') && user.name) {
        state.name = cleanFirebaseString(user.name);
      }
      const serverCoins = numericValue(user.COINS, linkCoins);
      const saved = readLocalSession(sessionKey);
      state.coins = numericValue(saved.coins, serverCoins);
    }
    dom.sessionNote.textContent = 'Account details were read from Firebase. Coins earned in this web quiz are saved only in this browser and are not written back to Firebase.';
  } catch (error) {
    console.error('[Web Quiz] Could not load account details:', error);
    dom.sessionNote.textContent = 'Could not load the Firebase account record. The quiz can still run; balance shown is from the app link or this browser.';
  }
  updateHeader();
}

function addProfileDetail(parent, label, value) {
  const row = document.createElement('div');
  row.className = 'profile-detail-row';
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  const valueElement = document.createElement('strong');
  valueElement.textContent = value || '—';
  row.append(labelElement, valueElement);
  parent.append(row);
}

async function showOption(name) {
  const titles = {
    profile: 'My Profile',
    password: 'Password',
    policy: 'Policy',
  };
  if (!titles[name]) return;

  dom.optionTitle.textContent = titles[name];
  dom.optionContent.replaceChildren();
  dom.optionMessage.textContent = '';
  dom.optionPageMessage.textContent = '';
  setScreen('option');

  if (name === 'profile') {
    if (state.phone) {
      try {
        const user = await readFirebase(`DATA/${state.phone}`);
        if (user && typeof user === 'object' && !Array.isArray(user)) {
          state.profile = user;
          if (!params.has('name') && user.name) {
            state.name = cleanFirebaseString(user.name);
            updateHeader();
          }
          if (!params.has('coins') && user.COINS !== undefined) {
            state.coins = numericValue(user.COINS, state.coins);
            updateHeader();
          }
        }
      } catch (error) {
        console.error('[Web Quiz] Could not refresh profile data:', error);
        dom.optionMessage.textContent = 'Could not refresh account data from Firebase. Showing the available link information.';
      }
    }

    const summary = document.createElement('section');
    summary.className = 'profile-summary';
    const avatar = document.createElement('span');
    avatar.className = 'profile-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = state.name ? state.name.charAt(0).toUpperCase() : '👤';
    const identity = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = state.name || 'Player';
    const phone = document.createElement('p');
    phone.textContent = state.phone ? `+91 ${state.phone.replace(/^\+/, '')}` : 'Guest account';
    identity.append(name, phone);
    summary.append(avatar, identity);

    const details = document.createElement('section');
    details.className = 'profile-details';
    const profileName = state.profile?.name
      ? cleanFirebaseString(state.profile.name)
      : state.name;
    addProfileDetail(details, 'Name', profileName);
    addProfileDetail(details, 'Mobile number', state.phone ? `+91 ${state.phone.replace(/^\+/, '')}` : '');
    addProfileDetail(details, 'Coins', String(state.coins));
    addProfileDetail(details, 'Account status', state.phone ? 'Account details loaded' : 'Guest');
    dom.optionContent.append(summary, details);
    return;
  }

  if (name === 'password') {
    const card = document.createElement('section');
    card.className = 'password-help';
    const heading = document.createElement('h3');
    heading.textContent = 'Password assistance';
    const copy = document.createElement('p');
    copy.textContent = 'For your security, password changes need verified account access. Contact A2 Morning support on WhatsApp to request help.';
    const button = document.createElement('button');
    button.className = 'primary-button';
    button.type = 'button';
    button.textContent = 'CONTACT SUPPORT';
    button.addEventListener('click', () => void openWhatsApp('I need help with my A2 Morning password.'));
    card.append(heading, copy, button);
    dom.optionContent.append(card);
    return;
  }

  try {
    const settings = await readFirebase('Admin/Admin');
    const policy = settings && typeof settings === 'object' ? settings.Policy : null;
    const policyText = Array.isArray(policy)
      ? policy.map((paragraph) => cleanFirebaseString(paragraph)).join('\n\n')
      : cleanFirebaseString(policy);
    const heading = document.createElement('p');
    heading.className = 'policy-heading';
    heading.textContent = 'ACCOUNT INFORMATION';
    const copy = document.createElement('section');
    copy.className = 'policy-copy';
    if (policyText.trim()) {
      policyText.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).forEach((paragraph) => {
        const element = document.createElement('p');
        element.textContent = paragraph;
        copy.append(element);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'option-empty';
      empty.textContent = 'Policy is not available. The administrator has not published privacy information yet.';
      copy.append(empty);
    }
    dom.optionContent.append(heading, copy);
  } catch (error) {
    console.error('[Web Quiz] Could not load the privacy policy:', error);
    const message = document.createElement('p');
    message.className = 'option-empty';
    message.textContent = 'Could not load the policy from Firebase. Please try again later.';
    dom.optionContent.append(message);
  }
}

function setLoadingMessage(message) {
  dom.loadingMessage.textContent = message;
  setScreen('loading');
}

function showQuestion() {
  const question = state.questions[state.questionIndex];
  if (!question) {
    showResults();
    return;
  }
  state.answerLocked = false;
  dom.backButton.disabled = false;
  dom.questionCount.textContent = `${state.questionIndex + 1} / ${state.questions.length}`;
  dom.correctCount.textContent = String(state.correct);
  dom.questionNumber.textContent = `QUESTION ${state.questionIndex + 1}`;
  dom.questionText.textContent = question.question;
  dom.quizMessage.textContent = '';
  dom.answerList.replaceChildren();

  question.options.forEach((option, optionIndex) => {
    const button = document.createElement('button');
    button.className = 'answer-button';
    button.type = 'button';
    button.textContent = option;
    button.addEventListener('click', () => answerQuestion(optionIndex), { once: true });
    dom.answerList.append(button);
  });
}

function updateTimer() {
  dom.timer.textContent = `Time Remaining: ${formatTime(state.secondsRemaining)}`;
  dom.timer.classList.toggle('low-time', state.secondsRemaining <= 10);
  if (state.secondsRemaining === 0) {
    stopTimer();
    showResults();
  }
}

function startTimer() {
  stopTimer();
  state.secondsRemaining = 150;
  updateTimer();
  state.timerId = window.setInterval(() => {
    state.secondsRemaining = Math.max(0, state.secondsRemaining - 1);
    updateTimer();
  }, 1000);
}

function stopTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function clearAdvanceTimeout() {
  if (state.advanceTimeoutId !== null) {
    window.clearTimeout(state.advanceTimeoutId);
    state.advanceTimeoutId = null;
  }
}

async function startQuiz() {
  stopTimer();
  clearAdvanceTimeout();
  dom.errorPanel.hidden = true;
  setLoadingMessage('Loading quiz questions…');
  try {
    const record = await readFirebase('Special Quizz/Quiz1');
    state.questions = parseQuizRecord(record);
    state.questionIndex = 0;
    state.correct = 0;
    state.matches = 0;
    state.earned = 0;
    setScreen('quiz');
    showQuestion();
    startTimer();
  } catch (error) {
    showError(error, startQuiz);
  }
}

function answerQuestion(optionIndex) {
  if (state.answerLocked || !state.questions[state.questionIndex]) return;
  state.answerLocked = true;
  dom.backButton.disabled = true;
  const question = state.questions[state.questionIndex];
  const buttons = [...dom.answerList.querySelectorAll('.answer-button')];
  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === question.correctIndex) button.classList.add('correct-answer');
    if (index === optionIndex && index !== question.correctIndex) button.classList.add('wrong-answer');
  });

  state.matches += 1;
  if (optionIndex === question.correctIndex) {
    state.correct += 1;
    state.earned += 5;
    state.coins += 5;
    dom.quizMessage.textContent = 'Correct! You earned 5 coins.';
  } else {
    dom.quizMessage.textContent = 'Not quite. The correct answer is highlighted.';
  }
  dom.correctCount.textContent = String(state.correct);
  updateHeader();
  persistLocalSession();

  state.advanceTimeoutId = window.setTimeout(() => {
    state.advanceTimeoutId = null;
    if (dom.quiz.hidden) return;
    if (state.questionIndex + 1 >= state.questions.length) {
      stopTimer();
      showResults();
      return;
    }
    state.questionIndex += 1;
    showQuestion();
  }, 500);
}

function showResults() {
  stopTimer();
  clearAdvanceTimeout();
  dom.resultScore.textContent = `${state.correct} / ${state.questions.length}`;
  dom.resultTotal.textContent = String(state.questions.length);
  dom.resultMatches.textContent = String(state.matches);
  dom.resultEarned.textContent = `+${state.earned}`;
  dom.resultBalance.textContent = String(state.coins);
  dom.resultSaveNote.textContent = localStorageAvailable
    ? 'Earned coins are saved only in this browser. Firebase is read-only in this version.'
    : 'This browser could not save quiz progress. Firebase is read-only in this version, so earned coins will be lost when you leave.';
  setScreen('results');
}

function returnToDashboard() {
  stopTimer();
  clearAdvanceTimeout();
  dom.backButton.disabled = false;
  dom.logoutDialog.hidden = true;
  updateHeader();
  setScreen('dashboard');
}

function openLogoutDialog() {
  dom.logoutDialog.hidden = false;
  dom.cancelLogout.focus();
}

function logoutToGuest() {
  try {
    window.localStorage.removeItem(sessionKey);
  } catch (error) {
    console.error('[Web Quiz] Could not clear the local quiz session:', error);
  }
  state.name = '';
  state.phone = '';
  state.profile = null;
  state.coins = 0;
  history.replaceState(null, '', window.location.pathname);
  dom.sessionNote.textContent = 'Logged out. You can continue as a guest or reopen this page from the app to load account details. No login page is used.';
  returnToDashboard();
}

function contactPhone(value) {
  const contact = cleanFirebaseString(value).trim();
  const linkPhone = contact.match(/(?:wa\.me\/|phone=)(\+?\d+)/i)?.[1];
  const digits = (linkPhone || contact).replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15 ? digits : '';
}

async function openWhatsApp(message = 'Hello, I need help with A2 Morning.') {
  try {
    const contact = await readFirebase('Admin/Contact');
    const phone = contactPhone(contact);
    if (!phone) {
      throw new Error('WhatsApp support contact is not configured in Firebase Admin/Contact.');
    }
    const text = state.phone && message.includes('password')
      ? `${message} My mobile number is ${state.phone.replace(/^\+/, '')}.`
      : message;
    window.location.assign(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
  } catch (error) {
    console.error('[Web Quiz] Could not open WhatsApp support:', error);
    const message = error instanceof Error ? error.message : 'Unable to open WhatsApp support.';
    if (dom.optionView.hidden) {
      dom.optionMessage.textContent = message;
    } else {
      dom.optionPageMessage.textContent = message;
    }
  }
}

async function shareApp() {
  const shareUrl = 'https://play.google.com/store/apps/details?id=a2.morning.ck';
  const message = `Hello Friend,\n\nI'm Using *A2 Morning*\n\nApp to WakeUp Morning with play Math Quiz...\n\nDownload Now:\n${shareUrl}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'A2 Morning', text: message, url: shareUrl });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      dom.optionMessage.textContent = 'App link copied. Share it with your friends.';
    } else {
      throw new Error('Sharing is not available in this browser.');
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    console.error('[Web Quiz] Could not share the app:', error);
    dom.optionMessage.textContent = error instanceof Error ? error.message : 'Unable to share the app.';
  }
}

document.querySelector('.options-list').addEventListener('click', (event) => {
  const option = event.target.closest('[data-option]')?.dataset.option;
  if (option === 'profile' || option === 'password' || option === 'policy') {
    void showOption(option);
  } else if (option === 'share') {
    void shareApp();
  } else if (option === 'whatsapp') {
    void openWhatsApp();
  } else if (option === 'logout') {
    openLogoutDialog();
  }
});

dom.startButton.addEventListener('click', () => void startQuiz());
dom.againButton.addEventListener('click', () => void startQuiz());
dom.backButton.addEventListener('click', returnToDashboard);
dom.dashboardButton.addEventListener('click', returnToDashboard);
dom.retryButton.addEventListener('click', () => void startQuiz());
dom.errorBackButton.addEventListener('click', returnToDashboard);
dom.optionBackButton.addEventListener('click', returnToDashboard);
dom.cancelLogout.addEventListener('click', () => { dom.logoutDialog.hidden = true; });
dom.confirmLogout.addEventListener('click', logoutToGuest);
dom.logoutDialog.addEventListener('click', (event) => {
  if (event.target === dom.logoutDialog) dom.logoutDialog.hidden = true;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dom.logoutDialog.hidden) {
    dom.logoutDialog.hidden = true;
  }
});

updateHeader();
setScreen('dashboard');
void loadPlayerData().catch((error) => {
  console.error('[Web Quiz] Failed to initialize player data:', error);
  dom.sessionNote.textContent = 'Could not load account details. You can still start the quiz as a guest.';
});
