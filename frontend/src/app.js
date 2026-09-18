import { requestApi } from './api.js';
import {
  escapeHtml,
  renderEventLog,
  renderManageHold,
  renderSeatMap
} from './views.js';

const POLLING_INTERVAL_MS = 3000;
const state = {
  screen: 'seats',
  email: '',
  selectedSeat: null,
  seats: [],
  message: null,
  events: [],
  eventSeatFilter: '',
  isLoading: true,
  isSubmitting: false
};

const root = document.querySelector('#root');

function setMessage(type, text) {
  state.message = { type, text };
  render();
}

async function loadSeats(showLoading = false) {
  if (showLoading) {
    state.isLoading = true;
    render();
  }

  try {
    const data = await requestApi('/api/seats');
    state.seats = data.seats;
    const selectedSeat = state.seats.find((seat) => (
      seat.number === state.selectedSeat && seat.status === 'available'
    ));
    state.selectedSeat = selectedSeat ? selectedSeat.number : null;
  } catch (error) {
    state.message = { type: 'error', text: error.message };
  } finally {
    state.isLoading = false;
    render();
  }
}

async function loadEvents() {
  const query = state.eventSeatFilter
    ? `?seatNumber=${state.eventSeatFilter}`
    : '';
  state.isLoading = true;
  render();

  try {
    const data = await requestApi(`/api/events${query}`);
    state.events = data.events;
  } catch (error) {
    state.message = { type: 'error', text: error.message };
  } finally {
    state.isLoading = false;
    render();
  }
}

async function submitHold() {
  if (!state.email.trim() || !state.selectedSeat) {
    setMessage('error', 'Enter your email and select an available seat.');
    return;
  }

  state.isSubmitting = true;
  state.message = null;
  render();

  try {
    const data = await requestApi('/api/holds', {
      method: 'POST',
      body: JSON.stringify({
        email: state.email.trim(),
        seatNumber: state.selectedSeat
      })
    });
    state.message = {
      type: 'success',
      text: `Seat ${data.hold.seatNumber} is held. Your hold code is ${data.hold.code}.`
    };
    state.selectedSeat = null;
    await loadSeats();
  } catch (error) {
    state.message = { type: 'error', text: error.message };
  } finally {
    state.isSubmitting = false;
    render();
  }
}

async function joinWaitlist() {
  if (!state.email.trim()) {
    setMessage('error', 'Enter your email before joining the waitlist.');
    return;
  }

  state.isSubmitting = true;
  state.message = null;
  render();

  try {
    const data = await requestApi('/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: state.email.trim() })
    });
    state.message = {
      type: 'success',
      text: `You joined the waitlist at position ${data.waitlistEntry.position}.`
    };
  } catch (error) {
    state.message = { type: 'error', text: error.message };
  } finally {
    state.isSubmitting = false;
    render();
  }
}

async function manageHold(actionName) {
  const actions = {
    confirm: ['/api/holds/confirm', 'confirmation', 'Your hold was confirmed.'],
    extend: ['/api/holds/extend', 'hold', 'Your hold was extended.'],
    release: ['/api/holds/release', 'release', 'Your seat was released.']
  };
  const [path, resultKey, successMessage] = actions[actionName];
  const email = document.querySelector('#manage-email').value.trim();
  const holdCode = document.querySelector('#hold-code').value.trim().toUpperCase();

  if (!email || !holdCode) {
    setMessage('error', 'Enter your email and hold code.');
    return;
  }

  state.isSubmitting = true;
  state.message = null;
  render();

  try {
    const data = await requestApi(path, {
      method: 'POST',
      body: JSON.stringify({ email, holdCode })
    });
    const result = data[resultKey];
    state.message = {
      type: 'success',
      text: `${successMessage} ${result.status ? `Status: ${result.status}.` : ''}`.trim()
    };
  } catch (error) {
    state.message = { type: 'error', text: error.message };
  } finally {
    state.isSubmitting = false;
    render();
  }
}

function render() {
  const headings = {
    seats: ['LIVE EVENT SEATING', 'Choose your seat', 'Select an available seat to place a temporary hold.'],
    manage: ['RESERVATION DETAILS', 'Manage your hold', 'Confirm, extend, or release an existing hold.'],
    events: ['SYSTEM HISTORY', 'Event log', 'Review reservation activity in chronological order.']
  };
  const [eyebrow, title, intro] = headings[state.screen];
  const availableCount = state.seats.filter((seat) => seat.status === 'available').length;
  const summary = state.screen === 'seats'
    ? `<div class="availability-summary"><strong>${availableCount}</strong><span>available</span></div>`
    : '';
  const content = state.screen === 'seats'
    ? renderSeatMap(state)
    : state.screen === 'manage'
      ? renderManageHold(state)
      : renderEventLog(state);

  root.innerHTML = `
    <main class="page-shell">
      <section class="reservation-panel" aria-labelledby="page-title">
        <nav class="view-switcher" aria-label="Reservation screens">
          <button class="view-tab ${state.screen === 'seats' ? 'view-tab-active' : ''}" data-screen="seats" type="button">Seat map</button>
          <button class="view-tab ${state.screen === 'manage' ? 'view-tab-active' : ''}" data-screen="manage" type="button">Manage hold</button>
          <button class="view-tab ${state.screen === 'events' ? 'view-tab-active' : ''}" data-screen="events" type="button">Event log</button>
        </nav>
        <header class="page-header">
          <div><p class="eyebrow">${eyebrow}</p><h1 id="page-title">${title}</h1><p class="intro">${intro}</p></div>
          ${summary}
        </header>
        ${content}
        <footer class="page-footer"><span>Seat status updates automatically</span></footer>
      </section>
    </main>`;

  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-screen]').forEach((button) => {
    button.addEventListener('click', () => {
      state.screen = button.dataset.screen;
      state.message = null;
      render();
      if (state.screen === 'events') {
        loadEvents();
      }
    });
  });

  const emailInput = root.querySelector('#email');
  if (emailInput) {
    emailInput.addEventListener('input', (event) => {
      state.email = event.target.value;
    });
  }

  root.querySelectorAll('[data-seat-number]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSeat = Number(button.dataset.seatNumber);
      render();
    });
  });

  const holdForm = root.querySelector('#hold-form');
  if (holdForm) {
    holdForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitHold();
    });
  }

  const waitlistButton = root.querySelector('#join-waitlist');
  if (waitlistButton) {
    waitlistButton.addEventListener('click', joinWaitlist);
  }

  const manageForm = root.querySelector('#manage-form');
  if (manageForm) {
    manageForm.addEventListener('submit', (event) => {
      event.preventDefault();
      manageHold(event.submitter.value);
    });
  }

  const eventFilter = root.querySelector('#event-seat-filter');
  if (eventFilter) {
    eventFilter.addEventListener('change', (event) => {
      state.eventSeatFilter = event.target.value;
      loadEvents();
    });
  }

  const clearFilter = root.querySelector('#clear-filter');
  if (clearFilter) {
    clearFilter.addEventListener('click', () => {
      state.eventSeatFilter = '';
      loadEvents();
    });
  }
}

render();
loadSeats(true);
window.setInterval(() => loadSeats(), POLLING_INTERVAL_MS);
